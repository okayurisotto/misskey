# okayurisotto/misskey

## backend

- 🚧 型関連
  - ✅ TSConfig basesを使うようにする
  - 🚧 TSConfigをより厳しくする
  - 🚧 型エラーをゼロにする
- ✅ AjvからZodへ移行する
  - ✅ Zodを使うabstractな`Endpoint`クラスを新しく作る
  - ✅ 実際のエンドポイントを新しく作ったエンドポイントに置き換える
  - ✅ Ajvへの依存をなくす
- ❓ `Endpoint`クラスの`override`方法を工夫する
  - ❓ `meta`や`paramDef`を`override`で定義するようにする
- ✅ validなOpenAPI Specを配信するようにする
- 🚧 Prismaへ移行しつつクエリを最適化する
	- ✅ Prismaをセットアップする
  - 🚧 `pack()`メソッドの使用をやめる
- ❓ テストのカバレッジを上げる
- ❓ ベンチマークを取れるようにする
- ❓ 積極的なジョブキューの活用
- ❓ `@bindThis`をやめる

## misskey-js

- ✅ OpenAPI Specから型定義を自動生成するようにする
- 🚧 型関連
  - 🚧 TSConfig basesを使うようにする
  - 🚧 TSConfigをより厳しくする
  - 🚧 型エラーをゼロにする
- 🚧 バンドラを使うようにする

## frontend

- 🚧 型関連
  - 🚧 TSConfig basesを使うようにする
  - 🚧 TSConfigをより厳しくする
  - 🚧 型エラーをゼロにする
- 🚧 ぼかし効果に関する設定の初期値をOFFに変更する
