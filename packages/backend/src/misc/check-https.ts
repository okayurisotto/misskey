import { NODE_ENV } from '@/env.js';

/**
 * URLがHTTPSであるか確認する。
 * `NODE_ENV`が`"production"`出なかった場合はHTTPも許容する。
 *
 * @param url
 * @returns
 */
export function checkHttps(url: string): boolean {
	if (url.startsWith('https://')) return true;
	if (url.startsWith('http://') && NODE_ENV !== 'production') return true;
	return false;
}
