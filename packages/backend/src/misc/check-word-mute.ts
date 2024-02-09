import { AhoCorasick } from 'slacc';
import RE2 from 're2';
import { Memoize } from 'memoize';
import type { Note, user } from '@prisma/client';

type CustomPartial<T, U extends keyof T> = Omit<T, U> & Partial<Pick<T, U>>;

type NoteLike = CustomPartial<Pick<Note, 'userId' | 'text' | 'cw'>, 'cw'>;
type UserLike = Pick<user, 'id'>;

const AHOCORASICK_CACHE_LIMIT = 1000;

class MemoizedAc extends Memoize<string[], AhoCorasick, string> {
	constructor() {
		super(AHOCORASICK_CACHE_LIMIT);
	}

	protected override serialize(arg: string[]): string {
		return JSON.stringify(arg);
	}

	protected override execute(arg: string[]): AhoCorasick {
		return AhoCorasick.withPatterns(arg);
	}
}

const memoizedAc = new MemoizedAc();

/**
 * ノートがワードミュートすべきものか判定する。
 *
 * @param note
 * @param me
 * @param mutedWords ワードミュート条件の配列
 * @returns
 */
export const checkWordMute = (
	note: NoteLike,
	me: UserLike | null | undefined,
	mutedWords: Array<string | string[]>,
): boolean => {
	if (me && note.userId === me.id) return false;
	if (mutedWords.length === 0) return false;

	const text = ((note.cw ?? '') + '\n' + (note.text ?? '')).trim();
	if (text === '') return false;

	{
		/** AhoCorasickで処理できる条件 */
		const acable = mutedWords
			.filter((filter) => Array.isArray(filter) && filter.length === 1)
			.map((filter) => filter[0])
			.sort();

		const ac = memoizedAc.compute(acable);

		if (ac.isMatch(text)) return true;
	}

	{
		/** AhoCorasickで処理できない条件 */
		const unacable = mutedWords.filter(
			(filter) => !Array.isArray(filter) || filter.length !== 1,
		);

		const matched = unacable.some((filter) => {
			if (Array.isArray(filter)) {
				return filter.every((keyword) => text.includes(keyword));
			} else {
				// represents RegExp
				const regexp = filter.match(/^\/(.+)\/(.*)$/);

				// This should never happen due to input sanitisation.
				if (!regexp) return false;

				try {
					return new RE2(regexp[1], regexp[2]).test(text);
				} catch (err) {
					// This should never happen due to input sanitisation.
					return false;
				}
			}
		});

		if (matched) return true;
	}

	return false;
};
