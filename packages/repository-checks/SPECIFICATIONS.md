# @mst/repository-checks

生成物。`vp run guard:fix` が `specs/` の仕様担保テストから再生成する。手で編集しない。

## CLI の終了コード

[`specs/exit-codes.spec.ts`](specs/exit-codes.spec.ts)

- 成功を 0 で表す
- 問題の発見を 1 で表す
- 誤った使い方を 2 で表す
