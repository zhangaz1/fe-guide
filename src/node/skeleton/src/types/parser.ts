import { IAst } from './common';

export type ASTFC = (ast: IAst) => any;

export interface IPath {
  root: string;
  srcPath?: string;
  protoPath?: string;
  mainPath?: string;
  examplePath?: string;
  mainFilePath?: string;
  pagePath?: string;
  compPath?: string;
}
