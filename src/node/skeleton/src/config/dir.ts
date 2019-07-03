import { join } from 'path';

export const ABS = process.cwd();

export const ROOT = join(ABS, '.');

export const OUTPUT_ROOT = `${ROOT}/src/examples`;

export const SRC = `${ROOT}/src`;

export const SKELETON_ROOT = `${OUTPUT_ROOT}/skeleton`;

export const SKELETON_PAGES_ROOT = `${SKELETON_ROOT}/pages`;

export const SKELETON_COMPS_ROOT = `${SKELETON_ROOT}/components`;
