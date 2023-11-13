import { Memo } from './Memo.js';

/**
 * 任意の処理をメモ化するためのabstractなクラス
 */
export abstract class Memoize<Arg, Result, Key = Arg> {
	private readonly memo;

	constructor(private readonly limit: number) {
		this.memo = new Memo<Key, Result>(this.limit);
	}

	/**
	 * 引数をSameValueZeroに基づいた比較ができるようにするためにシリアライズ化する
	 */
	protected abstract serialize(arg: Arg): Key;

	/**
	 * メモ化したい処理
	 */
	protected abstract execute(arg: Arg): Result;

	public compute(arg: Arg): Result {
		const key = this.serialize(arg);

		const memo = this.memo.get(key);
		if (memo !== undefined) return memo;

		const result = this.execute(arg);
		this.memo.set(key, result);

		return result;
	}
}
