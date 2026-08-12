# @mst/dont-review-it

生成物。`vp run guard:fix` が `specs/` の仕様担保テストから再生成する。手で編集しない。

## リポジトリ検査の入口

[`specs/check-entry.spec.ts`](specs/check-entry.spec.ts)

- check 以外の命令に使い方を返して失敗する
- 存在しない場所を検査対象に取らない
- 依存バージョンの食い違いを報告して失敗する
- test command が config を差し替える経路を報告して失敗する
- test command が coverage 設定を上書きする経路を報告して失敗する
