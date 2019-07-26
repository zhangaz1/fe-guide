import { join, resolve } from 'path';
import * as pathResolve from 'resolve';
import { isString } from 'util';
import {
  ATTR_BG,
  ATTR_CLEAR,
  ATTR_DARK_BG,
  ATTR_FOR,
  ATTR_HEIGHT,
  ATTR_LIGHT_BG,
  ATTR_MARGIN,
  ATTR_MARGIN_BOTTOM,
  ATTR_MARGIN_LEFT,
  ATTR_MARGIN_RIGHT,
  ATTR_MARGIN_TOP,
  ATTR_PADDING,
  ATTR_PADDING_BOTTOM,
  ATTR_PADDING_LEFT,
  ATTR_PADDING_RIGHT,
  ATTR_PADDING_TOP,
  ATTR_REMOVE,
  ATTR_REPEAT,
  ATTR_REPLACE,
  ATTR_SHOW,
  ATTR_WIDTH,
  BUTTON_TAG,
  COMP_JS,
  COMP_WXSS,
  ELEMENT_TAG,
  IMAGE_TAG,
  IMPORT_TAG,
  INCLUDE_TAG,
  JSON_CONFIG,
  KLASS,
  PATH,
  PRE,
  ROOT_TAG,
  TEMPLATE_TAG,
  TEXT,
  TPL_TAG,
  WX_ELIF,
  WX_ELSE,
  WX_FOR,
  WX_FOR_INDEX,
  WX_HIDDEN,
  WX_IF,
  WX_KEY,
  WXS_TAG,
  WXSS_BG_GREY,
} from '../config';
import { CF, IAst, ICO, IPath } from '../types';
import {
  triggerBgAction,
  triggerDarkBgAction,
  triggerHeightAction,
  triggerLightBgAction,
  triggerMarginAction,
  triggerMarginBottomAction,
  triggerMarginLeftAction,
  triggerMarginRightAction,
  triggerMarginTopAction,
  triggerPaddingAction,
  triggerPaddingBottomAction,
  triggerPaddingLeftAction,
  triggerPaddingRightAction,
  triggerPaddingTopAction,
  triggerReplaceAction,
  triggerWidthAction,
} from './action';
import { has, is, isArr, isFalsy, isStr, isTrue } from './assert';
import {
  hasCach,
  setCach,
} from './cach';
import {
  getDir,
  getFileName,
  getRelativePath,
} from './dir';
import {
  copy,
  ensure,
  exists,
  read,
  state,
  write,
} from './fs';
import {
  addSuffix,
  clearUsedComp,
  clearUsedTpl,
  ensureAndInsertWxml,
  ensureAndInsertWxss,
  hasOnlyTextChild,
  modifySuffix,
  updateTemplateInfo,
  updateUsingInJsonConfig,
} from './index';
import { Comp } from './klass';
import Logger from './log';
import {
  appendUniq,
  genKlass,
} from './random';
import {
  getTemplateName,
  hasWxVariable,
  interceptWxVariable,
  isBindEvent,
  isElif,
  isElse,
  isHidden,
  isId,
  isIf,
  isKlass,
  isNpmComponent,
  removeBlankAndWxVariable,
  replaceColorSymbol,
  replaceLengthSymbol,
  splitWith,
} from './reg';
import { cachKlassStruct } from './treeshake';

const {
  keys,
} = Object;
const emptyNode = {};
const logger = Logger.getInstance();

/**
 * parseAsTreeNode
 * @param ast
 * @param options
 */
export const parseAsTreeNode = (
  ast: IAst,
  options: IPath,
): IAst => (
  [
    parseFromConfig,
    parseFromCustomAttr,
    parseFromAttr,
    parseFromTag,
    parseFromNode,
    parseFromStruct,
  ].reduce((res: IAst, next) => next(res, options), ast)
);

/**
 * parseFromConfig
 * @param ast
 * @param options
 */
const parseFromConfig = (
  ast: IAst,
  options: IPath,
): IAst => {
  const { ignoreTags } = options;
  if (ignoreTags && ignoreTags.includes(ast.tag)) {
    return emptyNode;
  }
  return ast;
};

/**
 * parseFromNode
 * @param ast
 * @param options
 */
export const parseFromNode = (
  ast: IAst,
  options: IPath,
): IAst => {
  const { node, text } = ast;
  if (node !== TEXT) {
    if (node === ROOT_TAG) {
      setRootShow(ast, options);
    }
    return ast;
  }
  ast.text = removeBlankAndWxVariable(text);
  if (!ast.text) {
    return emptyNode;
  }
  return ast;
};

/**
 * parseFromCustomAttr
 * @param ast
 * @param options
 */
export const parseFromCustomAttr = (
  ast: IAst,
  options: IPath,
): IAst => {
  const { attr } = ast;
  if (!attr) { return ast; }
  const result: ICO = {};
  const attrKeys = keys(attr);
  const exceptKeys: string[] = [];
  for (let key, value, klass, i = 0; i < attrKeys.length; i += 1) {
    key = attrKeys[i];
    value = attr[key];
    klass = isStr(attr[KLASS]) ? [attr[KLASS]] : attr[KLASS] || [];
    switch (key) {
      // repeat
      // support 2 datatype:
      //  1. number / {{number}}
      //  2. variable which represents an array
      case ATTR_FOR:
      case ATTR_REPEAT:
        value = interceptWxVariable(value);
        result[WX_FOR] = isNaN(+value) ? `{{${value}}}` : `{{[${Array(+value).fill(1)}]}}`;
        result[WX_KEY] = `{{${attr[WX_FOR_INDEX] || 'index'}}}`;
        break;
      case ATTR_SHOW:
        result[WX_HIDDEN] = `{{false}}`;
        result[WX_IF] = '{{true}}';
        delete result[WX_ELIF];
        delete result[WX_ELSE];
        exceptKeys.push(WX_ELIF, WX_ELSE);
        break;
      case ATTR_REMOVE:
        return emptyNode;
      case ATTR_CLEAR:
        ast.child = [];
        break;
      case ATTR_REPLACE:
        triggerReplaceAction(ast, value);
        return ast;
      case ATTR_PADDING:
        triggerPaddingAction(ast, options, result, value, klass);
        break;
      case ATTR_MARGIN:
        triggerMarginAction(ast, options, result, value, klass);
        break;
      case  ATTR_PADDING_TOP:
        triggerPaddingTopAction(ast, options, result, value, klass);
        break;
      case  ATTR_PADDING_BOTTOM:
        triggerPaddingBottomAction(ast, options, result, value, klass);
        break;
      case  ATTR_PADDING_LEFT:
        triggerPaddingLeftAction(ast, options, result, value, klass);
        break;
      case  ATTR_PADDING_RIGHT:
        triggerPaddingRightAction(ast, options, result, value, klass);
        break;
      case  ATTR_MARGIN_TOP:
        triggerMarginTopAction(ast, options, result, value, klass);
        break;
      case  ATTR_MARGIN_BOTTOM:
        triggerMarginBottomAction(ast, options, result, value, klass);
        break;
      case  ATTR_MARGIN_LEFT:
        triggerMarginLeftAction(ast, options, result, value, klass);
        break;
      case  ATTR_MARGIN_RIGHT:
        triggerMarginRightAction(ast, options, result, value, klass);
        break;
      case ATTR_WIDTH:
        triggerWidthAction(ast, options, result, value, klass);
        break;
      case ATTR_HEIGHT:
        triggerHeightAction(ast, options, result, value, klass);
        break;
      case ATTR_BG:
        triggerBgAction(ast, options, result, value, klass);
        break;
      case ATTR_DARK_BG:
        triggerDarkBgAction(ast, options, result, value, klass);
        break;
      case ATTR_LIGHT_BG:
        triggerLightBgAction(ast, options, result, value, klass);
        break;
      default:
        if (!has(key, result) && !exceptKeys.includes(key)) {
          result[key] = value;
        }
        break;
    }
  }
  ast.attr = result;
  return ast;
};

/**
 * parseFromAttr
 * @param ast
 * @param options
 */
export const parseFromAttr = (
  ast: IAst,
  options: IPath,
): IAst => {
  const { attr, sibling } = ast;
  const { isPage, wxmlKlassInfo, treeshake } = options;
  if (!attr) { return ast; }
  const result: ICO = {};
  const attrKeys = keys(attr);
  for (let key, value, pureValue, i = 0; i < attrKeys.length; i += 1) {
    key = attrKeys[i];
    value = attr[key];
    pureValue = interceptWxVariable(value);
    switch (true) {
      // remove all events
      case isBindEvent(key):
        break;
      // hidden
      case treeshake && isHidden(key):
        if (!isFalsy(pureValue)) {
          return emptyNode;
        }
        result[key] = value;
        break;
      // wx:if
      // if this value eq false remove this element
      case treeshake && isIf(key):
        if (isFalsy(pureValue)) {
          return emptyNode;
        }
        result[key] = value;
        break;
      // wx:elif
      // if this value eq false, remove this element
      // else modify this attribute from `wx:elif` to `wx:if`
      case treeshake && isElif(key):
        if (isFalsy(pureValue)) {
          return emptyNode;
        } else if (isTrue(pureValue)) {
          result[WX_HIDDEN] = '{{false}}';
          result[WX_IF] = '{{true}}';
          break;
        } else {
          result[key] = value;
          break;
        }
      // wx:else
      // if pre sibling wx:if="{{true}}" remove this element
      // else remove this attribute `wx:else`
      case treeshake && isElse(key):
        let tmpSibling = sibling || {};
        if (!tmpSibling.node || !is(tmpSibling.node, ELEMENT_TAG)) {
          tmpSibling = tmpSibling.sibling || {};
        }
        const { node } = tmpSibling;
        const interceptValue = tmpSibling.attr && interceptWxVariable(tmpSibling.attr[WX_IF]);
        if (node && tmpSibling.attr && !isFalsy(interceptValue)) {
          return emptyNode;
        } else if (is(interceptValue, void 0)) {
          break;
        } else {
          result[key] = value;
          break;
        }
      // replace id(without wx variable) with a random class
      case isId(key):
        if (!hasWxVariable(value)) {
          const [klassName, klass] = genKlass();
          result.class = result.class || [];
          if (isArr(result.class)) {
            result.class.push(klassName);
          } else {
            result.class = [result.class, klassName];
          }
          wxmlKlassInfo[`#${value}`] = klass;
        }
        break;
      // class
      case isKlass(key):
        result.class = result.class || [];
        if (!value) {
          value = [];
        } else if (isString(value)) {
          value = [value];
        }
        result.class = value.concat(result.class);
        break;
      default:
        if (!has(key, result)) {
          result[key] = value;
        }
        break;
    }
  }
  ast.attr = result;
  return ast;
};

/**
 * parseFromStruct
 * @param ast
 * @param options
 */
export const parseFromStruct = (
  ast: IAst,
  options: IPath,
): IAst => {
  const { tag, attr } = ast;
  switch (true) {
    // <template />
    // cach template file for wxss treeshake
    case is(tag, TEMPLATE_TAG):
      if (attr && attr.name) {
        cachKlassStruct(`${TEMPLATE_TAG}.${attr.name}`, ast, options);
      }
      break;
    // cach class tag for wxss treeshake
    case !!(attr && attr.class):
      cachKlassStruct(attr.class, ast, options);
      break;
    default:
      break;
  }
  return ast;
};

/**
 * parseFromTag
 * @param ast
 * @param options
 */
export const parseFromTag = (
  ast: IAst,
  options: IPath,
): IAst => {
  const { tag, attr } = ast;
  const {
    defaultBg,
    protoPath,
    mainPath,
    skeletonKeys,
    usingComponentKeys,
    watch,
  } = options;
  if (!tag) { return ast; }
  const klass = attr && isStr(attr[KLASS]) ? [attr[KLASS]] : attr && attr[KLASS] || [];
  switch (true) {
    // <import />
    case is(tag, IMPORT_TAG):
      if (attr && attr.src) {
        const srcWxml: string = resolve(protoPath, attr.src);
        const destWxml: string = resolve(mainPath, attr.src);
        if (watch || !hasCach(destWxml, PATH)) {
          const srcWxss: string = modifySuffix(srcWxml, 'wxss');
          const destWxss: string = modifySuffix(destWxml, 'wxss');
          setCach(destWxml, 1, PATH);
          updateTemplateInfo(srcWxml, [attr.src, destWxml], options);
          ensureAndInsertWxml(srcWxml, destWxml, options);
          ensureAndInsertWxss(srcWxss, destWxss, options);
        }
      }
      break;
    // <template />
    case is(tag, TEMPLATE_TAG):
      if (attr.is) {
        clearUsedTpl(attr.is, options);
      }
      break;
    // <include />
    case is(tag, INCLUDE_TAG):
      if (attr && attr.src) {
        const srcWxml: string = resolve(protoPath, attr.src);
        const destWxml: string = resolve(mainPath, attr.src);
        if (watch || !hasCach(destWxml, PATH)) {
          setCach(destWxml, 1, PATH);
          ensureAndInsertWxml(srcWxml, destWxml, options);
        }
      }
      break;
    // <button />
    case is(tag, BUTTON_TAG):
      ast.tag = 'view';
      if (!attr) {
        ast.attr = {};
      }
      ast.attr[KLASS] = appendUniq(klass, WXSS_BG_GREY);
      break;
    // <image />
    case is(tag, IMAGE_TAG):
      if (!attr) {
        ast.attr = {};
      }
      ast.tag = 'view';
      if (ast.attr.src) {
        delete ast.attr.src;
      }
      if (ast.attr.mode) {
        delete ast.attr.mode;
      }
      ast.attr[KLASS] = appendUniq(klass, WXSS_BG_GREY);
      break;
    // remove <wxs />
    case is(tag, WXS_TAG):
      return emptyNode;
    // ignore skeleton tag
    // fix: compiling skeleton to skeleton
    case skeletonKeys.has(tag):
      return emptyNode;
    // if comp is used in pages, keep it
    case usingComponentKeys.has(tag):
      clearUsedComp(tag, options);
      break;
    default:
      if (defaultBg && hasOnlyTextChild(ast)) {
        if (!attr) {
          ast.attr = {};
        }
        ast.attr[KLASS] = appendUniq(klass, WXSS_BG_GREY);
      }
      break;
  }
  return ast;
};

/**
 * parseFromJSON
 * @param srcFile
 * @param destFile
 * @param json
 * @param options
 * @param isPage
 */
export const parseFromJSON = (
  srcFile: string,
  destFile: string,
  json: ICO,
  options: IPath,
  isPage?: boolean,
): ICO => {
  const {
    parentComp,
    usingComponentKeys,
    skeletonKeys,
    wxComponentInfo,
    watch,
  } = options;
  const src: string = getDir(srcFile);
  const dest: string = getDir(destFile);
  const { root, compPath, subPageRoot, outputPath } = options;
  const rootSrcPath = subPageRoot || options.srcPath;
  keys(json).forEach((key: string): void => {
    let pathValue: string = json[key];
    let [srcJs, destJs, srcWxml, destWxml, srcWxss, destWxss, srcJson, destJson] = Array(10);
    try {
      if (isNpmComponent(pathValue)) {
        pathValue = pathValue.slice(1);
        srcJs = pathResolve.sync(pathValue, { basedir: root });
        const srcJsFileName: string = getFileName(srcJs);
        const [srcJsName] = splitWith(srcJsFileName, '.');
        const destRoot: string = resolve(compPath, pathValue);
        srcJson = modifySuffix(srcJs, 'json');
        destJson = `${destRoot}/${modifySuffix(srcJsFileName, 'json')}`;
        destJs = `${destRoot}/${modifySuffix(srcJsFileName, 'js')}`;
        srcWxml = modifySuffix(srcJs, 'wxml');
        destWxml = `${destRoot}/${modifySuffix(srcJsFileName, 'wxml')}`;
        srcWxss = modifySuffix(srcJs, 'wxss');
        destWxss = `${destRoot}/${modifySuffix(srcJsFileName, 'wxss')}`;
        json[key] = `${getRelativePath(destRoot, destFile)}/${srcJsName}`;
      } else {
        const isRootStyle = /^\//.test(pathValue);
        if (isRootStyle) {
          pathValue = pathValue.slice(1);
        }
        let srcPath: string = resolve(isRootStyle ? rootSrcPath : src, pathValue);
        let destPath: string = resolve(isRootStyle ? outputPath : dest, pathValue);
        // fix: avoid compiling skeleton to skeleton
        if (srcPath.includes(outputPath)) {
          delete json[key];
          skeletonKeys.add(key);
          return;
        }

        try {
          if (state(srcPath).isDirectory()) {
            srcPath = `${srcPath}/index`;
            destPath = `${destPath}/index`;
          }
        } catch (err) {}
        srcJson = addSuffix(srcPath, 'json');
        destJson = addSuffix(destPath, 'json');
        srcJs = addSuffix(srcPath, 'js');
        destJs = addSuffix(destPath, 'js');
        srcWxml = addSuffix(srcPath, 'wxml');
        destWxml = addSuffix(destPath, 'wxml');
        srcWxss = addSuffix(srcPath, 'wxss');
        destWxss = addSuffix(destPath, 'wxss');
        json[key] = getRelativePath(destPath, destFile);
      }
    } catch (err) {
      return;
    }

    const thisComp: Comp = new Comp(key, destWxml);
    usingComponentKeys.set(key, thisComp);
    wxComponentInfo.add(destWxml);

    if (parentComp) {
      parentComp.addChild(thisComp);
    }

    if (watch || !hasCach(destWxml, PATH)) {
      // gen component-wxml
      setCach(destWxml, 1, PATH);
      ensureAndInsertWxml(srcWxml, destWxml, options);

      // gen component-json
      updateUsingInJsonConfig(srcJson, destJson, { ...options, parentComp: thisComp });

      // gen component-wxss
      ensureAndInsertWxss(srcWxss, destWxss, options);

      // gen component-js
      ensure(destJs);
      write(destJs, COMP_JS);

      // TODO copy Components.properties to destJs with babel
    }
  });
  return json;
};

/**
 * setRootShow
 * @param ast
 * @param options
 */
export const setRootShow = (
  ast: IAst,
  options: IPath,
): void => {
  const { child } = ast;
  const { isPage } = options;
  if (isPage && child && child.length) {
    child.forEach((
      ch: IAst,
    ) => {
      const { attr, tag } = ch;
      if (!tag) { return; }
      if (!attr) {
        ch.attr = {};
      }
      ch.attr[ATTR_SHOW] = '';
    });
  }
};
