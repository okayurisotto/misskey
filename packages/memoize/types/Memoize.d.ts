/**
 * 任意の処理をメモ化するためのabstractなクラス
 */
export declare abstract class Memoize<Arg, Result, Key = Arg> {
    private readonly limit;
    private readonly memo;
    constructor(limit: number);
    /**
     * 引数をSameValueZeroに基づいた比較ができるようにするためにシリアライズ化する
     */
    protected abstract serialize(arg: Arg): Key;
    /**
     * メモ化したい処理
     */
    protected abstract execute(arg: Arg): Result;
    compute(arg: Arg): Result;
}
