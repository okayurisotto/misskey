export const ID_GENERATION_METHODS = [
	'aid',
	'meid',
	'meidg',
	'ulid',
	'objectid',
] as const;

export const MAX_NOTE_TEXT_LENGTH = 3000;

export const USER_ONLINE_THRESHOLD = 1000 * 60 * 10; // 10min
export const USER_ACTIVE_THRESHOLD = 1000 * 60 * 60 * 24 * 3; // 3days

//#region hard limits
// If you change DB_* values, you must also change the DB schema.

/**
 * Maximum note text length that can be stored in DB.
 * Surrogate pairs count as one
 */
export const DB_MAX_NOTE_TEXT_LENGTH = 8192;

/**
 * Maximum image description length that can be stored in DB.
 * Surrogate pairs count as one
 */
export const DB_MAX_IMAGE_COMMENT_LENGTH = 512;
//#endregion

/**
 * ブラウザで直接表示することを許可するファイルの種類のリスト。
 * ここに含まれないものは application/octet-stream としてレスポンスされる。
 * SVGはXSSを生むので許可しない。
 *
 * https://github.com/sindresorhus/file-type/blob/main/supported.js
 * https://github.com/sindresorhus/file-type/blob/main/core.js
 * https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Containers
 */
export const FILE_TYPE_BROWSERSAFE = [
	// Images
	'image/png',
	'image/gif',
	'image/jpeg',
	'image/webp',
	'image/avif',
	'image/apng',
	'image/bmp',
	'image/tiff',
	'image/x-icon',

	// OggS
	'audio/opus',
	'video/ogg',
	'audio/ogg',
	'application/ogg',

	// ISO/IEC base media file format
	'video/quicktime',
	'video/mp4',
	'audio/mp4',
	'video/x-m4v',
	'audio/x-m4a',
	'video/3gpp',
	'video/3gpp2',

	'video/mpeg',
	'audio/mpeg',

	'video/webm',
	'audio/webm',

	'audio/aac',

	// see https://github.com/misskey-dev/misskey/pull/10686
	'audio/flac',
	'audio/wav',
	// backward compatibility
	'audio/x-flac',
	'audio/vnd.wave',
];

export const LEGACY_REACTIONS = new Map([
	['like', '👍'],
	['love', '❤'], // ここに記述する場合は異体字セレクタを入れない
	['laugh', '😆'],
	['hmm', '🤔'],
	['surprise', '😮'],
	['congrats', '🎉'],
	['angry', '💢'],
	['confused', '😥'],
	['rip', '😇'],
	['pudding', '🍮'],
	['star', '⭐'],
]);

export const FALLBACK_REACTION = '❤';
