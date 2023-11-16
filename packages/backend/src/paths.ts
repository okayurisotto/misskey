import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MISSKEY_CONFIG_YML, NODE_ENV } from './env.js';

/** `/packages/backend/built/paths.js` */
const _filename = fileURLToPath(import.meta.url);

/** `/packages/backend/built` */
const _dirname = dirname(_filename);

/** `/packages/backend` */
export const BACKEND_PACKAGE_DIR = resolve(_dirname, '../');

/** `/` */
export const REPOSITORY_ROOT_DIR = resolve(BACKEND_PACKAGE_DIR, '../../');

/** `/.config` */
export const CONFIG_DIR = resolve(REPOSITORY_ROOT_DIR, './.config');

/**
 * ```
 * /.config/${MISSKEY_CONFIG_YML}
 * /.config/default.yml
 * /.config/test.yml
 * ```
 */
export const CONFIG_FILE = ((): string => {
	if (MISSKEY_CONFIG_YML !== undefined) {
		return resolve(CONFIG_DIR, MISSKEY_CONFIG_YML);
	} else if (NODE_ENV === 'test') {
		return resolve(CONFIG_DIR, './test.yml');
	} else {
		return resolve(CONFIG_DIR, './default.yml');
	}
})();

/** `/built` */
export const BUILT_DIR = resolve(REPOSITORY_ROOT_DIR, './built');

/** `/built/_frontend_dist_` */
export const FRONTEND_ASSETS_DIR = resolve(BUILT_DIR, './_frontend_dist_');

/** `/built/_sw_dist_` */
export const SW_ASSETS_DIR = resolve(BUILT_DIR, `./_sw_dist_`);

/** `/built/_vite_` */
export const VITE_DIR = resolve(BUILT_DIR, `./_vite_`);

/** `/built/meta.json` */
export const META_FILE = resolve(BUILT_DIR, './meta.json');

/** `/built/_vite_/manifest.json` */
export const CLIENT_MANIFEST_FILE = resolve(VITE_DIR, './manifest.json');

/** `/packages/backend/nsfw-model` */
export const NSFW_MODEL_DIR = resolve(BACKEND_PACKAGE_DIR, './nsfw-model');

/** `/files` */
export const INTERNAL_STORAGE_DIR = resolve(REPOSITORY_ROOT_DIR, './files');

/** `/packages/backend/assets` */
export const BACKEND_STATIC_ASSETS_DIR = resolve(
	BACKEND_PACKAGE_DIR,
	'./assets',
);

/** `/packages/frontend` */
export const FRONTEND_PACKAGE_DIR = resolve(BACKEND_PACKAGE_DIR, '../frontend');

/** `/packages/frontend/assets` */
export const FRONTEND_STATIC_ASSETS_DIR = resolve(
	FRONTEND_PACKAGE_DIR,
	'./assets',
);

/** `/fluent-emojis/dist` */
export const FLUENT_EMOJIS_DIST_DIR = resolve(
	REPOSITORY_ROOT_DIR,
	'./fluent-emojis/dist',
);

/** `/packages/backend/node_modules/@discordapp/twemoji/dist/svg` */
export const TWEMOJI_DIST_DIR = resolve(
	BACKEND_PACKAGE_DIR,
	'./node_modules/@discordapp/twemoji/dist/svg',
);

/** `/packages/backend/built/server/web/views` */
export const VIEW_DIR = resolve(
	BACKEND_PACKAGE_DIR,
	'./built/server/web/views',
);
