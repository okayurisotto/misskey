/**
 * メモ管理クラス
 */
export class Memo<K, V> {
	private readonly data = new Map<K, V>();

	/**
	 * @param limit 保存するメモの数の上限
	 */
	constructor(private readonly limit: number) {}

	public set(key: K, value: V): void {
		// 上限以上にメモがあったら最初の1つだけ削除する
		if (this.data.size > this.limit) {
			for (const key of this.data.keys()) {
				this.data.delete(key);
				break;
			}
		}

		this.data.set(key, value);
	}

	public get(key: K): V | undefined {
		const value = this.data.get(key);

		if (value !== undefined) {
			this.data.delete(key);
			this.set(key, value);
		}

		return value;
	}
}
