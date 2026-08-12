# @mst/lint-rule-authoring

生成物。`vp run guard:fix` が `specs/` の仕様担保テストから再生成する。手で編集しない。

## lint ルールの重大度の語彙

[`specs/severity-vocabulary.spec.ts`](specs/severity-vocabulary.spec.ts)

- error と warn と off の 3 値だけを公開する
