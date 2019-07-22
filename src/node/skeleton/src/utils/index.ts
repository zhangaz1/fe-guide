import * as css from 'css';
import { html2json, json2html } from 'html2json';
import { DomElement, DomHandler, Parser } from 'htmlparser2';
import { join } from 'path';
import {
  COMP_JS,
  COMP_JSON,
  COMP_WXSS,
  DEFAULT_WXSS,
  JSON_CONFIG,
  TEXT,
} from '../config';
import { COMMENT_TAG, IMPORT_TAG, INCLUDE_TAG, RULE_TAG, TEMPLATE_TAG } from '../config/tag';
import { IAst, ICO, IComp, IPath, IUnused } from '../types';
import { is } from './assert';
import {
  addSuffix,
  getDir,
  getFileName,
  getPageWxml,
  getRelativePath,
  getSplitDir,
  identity,
  modifySuffix,
} from './dir';
import {
  copy,
  ensure,
  exists,
  read,
  remove,
  write,
} from './fs';
import { parseAsTreeNode, parseFromJSON } from './parser';
import {
  getTemplateIs,
  getTemplateName,
  matchIdStyle,
  removeComment,
  splitWith,
  withoutPageSelector,
} from './reg';

import { Comp } from './klass';
import Logger from './log';
import { styleTreeShake, wxmlTreeShake } from './treeshake';

const {
  parse,
  stringify,
} = JSON;
const emptyNode = {};
const logger = Logger.getInstance();

/**
 * html2ast
 * @param rawHtml
 */
export const html2ast = (rawHtml: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const parseHandler: DomHandler = new DomHandler((
      error: any,
      dom: DomElement[],
    ): any => {
      if (error) {
        reject(error);
      } else {
        resolve(dom);
      }
    });
    const parser: Parser = new Parser(parseHandler);
    parser.parseComplete(rawHtml);
  });
};

/**
 * treewalk
 * @param ast
 * @param options
 * @param isPage
 */
export const treewalk = (
  ast: IAst,
  options: IPath,
  isPage?: boolean,
): IAst => {
  if (ast) {
    ast = parseAsTreeNode(ast, { ...options, isPage });
    const { child } = ast;
    if (child && child.length) {
      child.forEach((
        ch: IAst,
        idx: number,
        chs: IAst[],
      ): void => {
        chs[idx] = treewalk(ch, options, isPage);
        chs[idx].parent = ast;
        (chs[idx + 1] || {}).sibling = chs[idx];
      });
    }
  }
  return ast;
};

/**
 * parseFile
 * @param src
 * @param dest
 * @param options
 * @param isPage
 */
export const parseFile = (
  src: string,
  dest: string,
  options: IPath,
  isPage?: boolean,
): string => {
  try {
    const { treeshake } = options;
    let content: string = removeComment(String(read(src)));
    if (treeshake && isPage) {
      content = wxmlTreeShake(content, src, options);
    }
    const json: ICO = html2json(content);
    return json2html(treewalk(json, {
      ...options,
      protoPath: getDir(src),
      mainPath: getDir(dest),
      mainFilePath: dest,
    }, isPage));
  } catch (err) {
    logger.warn(err);
    return '';
  }
};

/**
 * insertInitialWxss
 * @param template
 * @param wxss
 */
export const insertInitialWxss = (
  template: string,
  wxss?: string,
): string => {
  wxss = wxss || COMP_WXSS;
  return `${template}
${wxss}`;
};

/**
 * getJsonValue
 * @param path
 * @param key
 */
export const getJsonValue = (
  path: string,
  key: string,
): ICO | false => {
  try {
    const content: string = String(read(path));
    let json = parse(content);
    if (key) {
      json = json[key];
    }
    return json;
  } catch (error) {
    return false;
  }
};

/**
 * updateUsingInJsonConfig
 * @param src
 * @param dest
 * @param options
 * @param srcContent
 * @param isPage
 */
export const updateUsingInJsonConfig = (
  src: string,
  dest: string,
  options: IPath,
  srcContent?: string,
  isPage?: boolean,
): void => {
  try {
    ensure(dest);
    srcContent = srcContent || String(read(src));
    let usingComponent: ICO | false = getJsonValue(src, JSON_CONFIG.USING);
    if (usingComponent) {
      usingComponent = parseFromJSON(src, dest, usingComponent, options, isPage);
      const compJson: ICO = parse(srcContent);
      compJson[JSON_CONFIG.USING] = usingComponent;
      write(dest, stringify(compJson, null, 2));
    } else {
      write(dest, srcContent);
    }
  } catch (err) {
    logger.warn(err);
  }
};

export const updateUnusedJsonConfig = (
  dest: string,
  map: Map<string, Comp>,
): void => {
  if (map.size) {
    const content: string = read(dest) as string;
    const parseContent: ICO = parse(content);
    const keyIterator: IterableIterator<string> = map.keys();
    let next: IteratorResult<string> = keyIterator.next();
    while (!next.done) {
      delete parseContent[JSON_CONFIG.USING][next.value];
      next = keyIterator.next();
    }
    write(dest, stringify(parseContent));
  }
};

export const iterateUpdateUnusedWxmlConfig = (
  ast: IAst,
  imports: string[],
): IAst => {
  const { tag, attr, child } = ast;
  const hasAttr = attr && attr.src && imports.includes(attr.src);
  if (is(tag, IMPORT_TAG) && hasAttr) {
    return emptyNode;
  }
  if (child) {
    child.forEach((ch: IAst, idx: number, arr: IAst[]) => {
      arr[idx] = iterateUpdateUnusedWxmlConfig(ch, imports);
    });
  }
  return ast;
};

export const updateUnusedWxmlConfig = (
  dest: string,
  map: Map<string, string[]>,
): void => {
  const values = [...map.values()].map((paths: string[]) => paths[0]);
  const content: string = read(dest) as string;
  let ast = html2json(content);
  ast = iterateUpdateUnusedWxmlConfig(ast, values);
  write(dest, json2html(ast));
};

/**
 * ensureAndInsertWxss
 * @param src
 * @param dest
 */
export const ensureAndInsertWxss = (
  src: string,
  dest: string,
  options: IPath,
): void => {
  if (exists(src)) {
    ensure(dest);
    write(dest, insertInitialWxss(`@import '${getRelativePath(src, dest)}';`));
  }
};

/**
 * ensureAndInsertWxml
 * @param src
 * @param dest
 * @param options
 * @param isPage
 */
export const ensureAndInsertWxml = (
  src: string,
  dest: string,
  options?: IPath,
  isPage?: boolean,
): void => {
  ensure(dest);
  // copy(src, dest);
  write(
    dest,
    parseFile(src, dest, options, isPage),
  );
  if (options.verbose) {
    logger.await(dest);
  }
};

/**
 * insertPageWxss
 * @param src
 * @param dest
 */
export const insertPageWxss = (
  src: string,
  dest: string,
  options: IPath,
): void => {
  ensure(dest);
  const { wxmlKlassInfo, treeshake } = options;
  const content: string = String(exists(src) ? read(src) : '');
  const ast: css.Stylesheet = css.parse(content);
  let { rules } = ast.stylesheet;
  let hasPageStyle: boolean = false;

  rules.forEach((
    rule: css.Rule & css.Import,
    index: number,
  ) => {
    const { type, selectors } = rule;
    // { type: 'import', import: '"../../components/xx/xx.wxss"'}
    if (is(type, IMPORT_TAG)) {
      const srcPath: string = join(getDir(src), rule.import.slice(1, -1));
      rule.import = `"${getRelativePath(srcPath, dest)}"`;
   // { type: 'rule', selectors: [ '.loading-data', '.no-data' ]}
    } else if (is(type, RULE_TAG)) {
      const newSelectors: string[] = [];
      selectors.forEach((selector: string) => {
        const tmpSelectors: string[] = splitWith(selector);
        const last = tmpSelectors.length - 1;
        const lastSelector: string = tmpSelectors[last];

        if (withoutPageSelector(lastSelector)) {
          newSelectors.push(selector);
        } else {
          // if matching id style, rewrite style if is used in wxml
          const matchResult = matchIdStyle(lastSelector);
          if (matchResult) {
            const id = matchResult[2];
            if (wxmlKlassInfo[id]) {
              tmpSelectors[last] = lastSelector.replace(id, wxmlKlassInfo[id]);
              return newSelectors.push(tmpSelectors.join(' '));
            }
          }
          hasPageStyle = true;
        }
      });

      if (!newSelectors.length) {
        rules[index] = null;
      }
      rule.selectors = newSelectors;
    }
  });
  rules = rules.filter(identity);
  // wxss treeshake
  ast.stylesheet.rules = treeshake ? styleTreeShake(rules, options) : rules;

  if (hasPageStyle) {
    write(dest, insertInitialWxss(`${css.stringify(ast)}`));
  } else {
    ensureAndInsertWxss(src, dest, options);
  }
};

/**
 * genNewComponent
 * @param srcWxml
 * @param options
 */
export const genNewComponent = (
  srcWxml: string,
  options: IPath,
): void => {
  const { outputPath, srcPath, deleteUnused, usingComponentKeys, usingTemplateKeys } = options;
  const relativePath: string = srcWxml.replace(srcPath, '');
  const srcWxss: string = modifySuffix(srcWxml, 'wxss');
  const srcJson: string = modifySuffix(srcWxml, 'json');

  // gen json
  const destJson: string = `${outputPath}${modifySuffix(relativePath, 'json')}`;
  updateUsingInJsonConfig(srcJson, destJson, options, COMP_JSON, true);

  // gen wxml
  const destWxml: string = `${outputPath}${relativePath}`;
  ensureAndInsertWxml(srcWxml, destWxml, options, true);

  // gen wxss
  const destWxss: string = `${outputPath}${modifySuffix(relativePath, 'wxss')}`;
  insertPageWxss(srcWxss, destWxss, options);

  // gen js
  const destJs: string = `${outputPath}${modifySuffix(relativePath, 'js')}`;
  ensure(destJs);
  write(destJs, COMP_JS);

  // clear unused component in json file
  if (deleteUnused) {
    updateUnusedJsonConfig(destJson, usingComponentKeys);
    updateUnusedWxmlConfig(destWxml, usingTemplateKeys);
  }
  if (options.verbose) {
    logger.success(getDir(srcWxml));
  }
};

/**
 * genResourceFile
 * @param resourceRoot
 * @param content
 */
export const genResourceFile = (resourceRoot: string, content: string): void => {
  ensure(resourceRoot);
  write(resourceRoot, content);
};

/**
 * transMap2Style
 * @param maps
 */
export const transMap2Style = (
  ...maps: Array<Map<string, string>>
): string => {
  let result = '';
  maps.forEach((map: Map<string, string>): void => {
    const keys: IterableIterator<string> = map.keys();
    for (const key of keys) {
      result += `${key.indexOf('@') ? '.' : ''}${key} {${map.get(key)}}\n`;
    }
  });
  return result;
};

export const getTplKey = (
  key: string,
  path: string,
): string => `${key}$${path}`;

/**
 * updateTemplateInfo
 * @param src
 * @param dest
 * @param options
 */
export const updateTemplateInfo = (
  src: string,
  dest: string[],
  options: IPath,
): void => {
  const { parentTpl, usingTemplateKeys, wxTemplateInfo } = options;
  const content: string = read(src) as string;
  const names = getTemplateName(content);
  const iss = getTemplateIs(content);
  const tplName = names.filter((name: string): boolean => !iss.includes(name))[0];
  const [, absolutePath] = dest;
  const tpl = new Comp(tplName, absolutePath);
  usingTemplateKeys.set(tplName, dest);
  wxTemplateInfo.set(getTplKey(tplName, absolutePath), tpl);
  if (parentTpl) {
    parentTpl.addChild(tpl);
  }
  options.parentTpl = tpl;
};

export const removeUnused = ({
  template,
  component,
}: IUnused): void => {
  // remove unused component
  component.forEach((fileName: string) => {
    const dir = getDir(fileName);
    remove(dir);
  });

  // remove unused template
  template.forEach((tpl) => {
    const { path } = tpl;
    const wxss = modifySuffix(path, 'wxss');
    remove(path);
    if (exists(wxss)) {
      remove(wxss);
    }
  });
};

/**
 * clearUsedComp
 * @param tag
 * @param options
 */
export const clearUsedComp = (
  tag: string,
  options: IPath,
): void => {
  const { usingComponentKeys, wxComponentInfo } = options;
  const thisComp = usingComponentKeys.get(tag);
  const { path } = thisComp;
  wxComponentInfo.delete(path);
  usingComponentKeys.delete(tag);
  thisComp.iterateChild((ch: Comp) => {
    wxComponentInfo.delete(ch.path);
    usingComponentKeys.delete(ch.tag);
  });
};

export const clearUsedTpl = (
  key: string,
  options: IPath,
): void => {
  const { usingTemplateKeys, wxTemplateInfo } = options;
  const dest = usingTemplateKeys.get(key);
  if (dest) {
    const [, destValue] = dest;
    if (destValue) {
      usingTemplateKeys.delete(key);
      const tplKey = getTplKey(key, destValue);
      const thisTpl = wxTemplateInfo.get(tplKey);
      wxTemplateInfo.delete(tplKey);
      thisTpl.iterateChild((ch: Comp) => {
        usingTemplateKeys.delete(ch.tag);
        wxTemplateInfo.delete(getTplKey(ch.tag, ch.path));
      });
    }
  }
};

export {
  html2json,
  json2html,
};

export {
  addSuffix,
  getDir,
  getFileName,
  getPageWxml,
  getRelativePath,
  getSplitDir,
  identity,
  modifySuffix,
};
