/**
 * メモ管理クラス
 */
export declare class Memo<K, V> {
    private readonly limit;
    private readonly data;
    /**
     * @param limit 保存するメモの数の上限
     */
    constructor(limit: number);
    set(key: K, value: V): void;
    get(key: K): V | undefined;
}
