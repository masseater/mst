# 0022. production グラフの検査を必須ゲートにし、ゲートの定義を 1 つにする

- ステータス: Accepted
- 日付: 2026-08-10

## 状況

ゲートの定義が 3 つに分かれていた。

- `.vite-hooks/pre-push` は `vp check` と `vp run knip --production`
- ルートの `ready` スクリプトは `vp check` / test / build / `knip` / `dont-review-it verify` / `duplicated-bodies` / `docs`
- CI の `ready` ジョブは、そのうち `duplicated-bodies` と `docs` を欠いた 5 ステップ

どれを通しても他の 2 つを通ったことにはならない。実際、pre-push だけが `--production` を見ており、main の時点で 12 件を報告して push を止めていた。CI は素の `knip` しか見ていないので緑のままだった。

[EDR 0018](./0018-narrow-the-export-surface-to-what-is-used.md) は「`--production` は採らない」と書いている。理由は、このモードが test とツール設定からの参照を数えないため `testLintRule` と `oxlint` が未使用として出る、というものだった。この判断が先に入ったことで、production グラフを見る検査そのものが捨てられた。

## 決定

`knip --production` を必須のゲートにする。EDR 0018 の「`--production` は採らない」は取り消す。

production グラフから到達しない export は 2 種類しかない。外部の利用者のために開いている公開面か、テストのためだけに開いた口かである。前者は静的解析から見えない事実なので `/** @public */` で機械に渡す。EDR 0005 が定めたとおり、JSDoc タグは解析が到達できない事実を渡すために使う。後者は塞ぐ。

素の `knip` はこの 2 つを区別しない。テストが import していれば使用済みになるので、テストのためだけに開いた口が永久に残る。区別を強制できることが `--production` の値打ちであり、EDR 0018 が挙げた「`testLintRule` と `oxlint` が未使用として出る」は、区別を宣言していないことの表れであって、モデルが合っていない証拠ではなかった。

あわせて、ゲートの定義を `ready` 1 つにする。pre-push と CI はどちらも `pnpm ready` を呼ぶ。定義が 1 箇所になるので、ゲートに 1 段足したときに 3 箇所を揃える作業が消え、「手元は通ったのに CI で落ちる」も「CI は通るのに push できない」も起きなくなる。pre-push は `vp check` だけの頃より遅くなるが、押した後で気づく取りこぼしと引き換えである。

## 帰結

`--production` が報告していた 12 件は、次の 3 通りに畳んだ。

- **公開面として `/** @public */` を付けたもの（8 箇所）。** `@mst/dont-review-it` の `oxlint` と `withGitExcludes`、`@mst/lint-rule-authoring` の `oxlint` と `testLintRule`。宣言側と barrel の両方に付ける。前 2 つは利用者の `vite.config.ts` が、後の 1 つはルールを書く人のテストが使う。どちらもこのリポジトリの production グラフからは到達しない
- **テストのためだけに開いていた口を塞いだもの（3 件）。** `LINT_RULE_SEVERITIES` は同じファイルの中でしか使われていないので `export` を落とし、語彙を照合していたテストは `LINT_SEVERITY` の 1 本に畳んだ。`WorkspaceLintRuleDocs` も `export` を落とし、単一使用になった時点で使用箇所へ展開した。型注釈が `url` を見せるために効いていたテストは、公開している `WorkspaceLintRule` から辿る形に変えた
- **どこからも使われていなかったものを消したもの（1 件）。** `twinClustersIn` は production から 1 度も呼ばれていなかった。`no-twin-declaration` は `namedFingerprintOf` を使っており、この関数を必要としていない。宣言とテストを消した

`toNormativeDocument` は production で使われているのに未使用として出ていた。同じファイルの中でしか使われていなかったためである。文書 1 つを組み立てる責務と、リポジトリを走査して文書を集める責務が 1 ファイルに同居していたので、後者を `scan/load-normative-documents.ts` へ分けた。これで前者は別モジュールから import されるようになり、12 のテストは文字列から文書を組み立てる継ぎ目を保ったままになる。
