# 0018. 公開面を実際に使われている分だけにし、機械に見張らせる

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

`vp run ready` は knip を通しているが、この時点まで一度も何も報告していなかった。ゲートとして数えていたものが、実際には何も見ていない。

原因は knip の `includeEntryExports` が既定で false であることにある。パッケージの `exports` が指すファイル（このリポジトリでは `src/index.ts` と `src/plugin.ts`）はエントリとして扱われ、エントリの export は未使用判定から外れる。内部モジュールの export はすべて `src/index.ts` の再エクスポートに到達するため、「barrel が使っている」という理由で使用済みになる。その barrel 自身が見られていないので、連鎖の起点が検査されない状態だった。

有効にすると、値 7 件と型 8 件が未使用として出た。内訳は 3 通りに分かれる。

- barrel が公開しているが、実際にはパッケージ内から相対 import でしか使われていないもの（`createDontReviewItRule`、`createLintRuleAuthoringRule`、`LINT_RULE_SEVERITIES`、`workspaceLintRuleDocsRelativePath`、`workspaceLintRuleDocsUrl`、`WorkspaceLintRuleDocs`、`WorkspaceLintRuleIdentity`）
- 宣言したファイルの中でしか参照されていない型（`WorkspaceLintRuleMeta`、`LintRuleSeverity`、`LintRuleTestCases`）
- どこからも参照されていない型（`WorkspaceLintRuleFactory`）

残る 2 件は `plugin.ts` の default export である。これは oxlint が `jsPlugins` の指定子文字列 `@mst/dont-review-it/plugin` から読む入口であり、リポジトリ内に静的な import が 1 つも無い。静的解析からは未使用にしか見えない。

## 決定

`includeEntryExports` を `knip.json` に置き、barrel を検査対象にする。CLI フラグではなく設定ファイルに置くのは、`ready` が素の `knip` を呼ぶためである。

出た未使用は、使われ方に応じて 3 通りに畳む。

- パッケージ内からしか使われないものは barrel の行だけを消す。宣言と、それを import している側は変えない
- 宣言したファイルの中でしか参照されない型は `export` を落とす。tsdown は非 export の型もローカル宣言として `.d.ts` に出すため、公開している型が参照していても壊れない
- どこからも参照されない宣言は消す

`plugin.ts` の default export には `/** @public */` を置く。EDR 0005 が「コメント構文に残せるのは JSDoc の `@tag` の中身だけになり、それを書く場面がまだ無い。公開 API に JSDoc を書く段で決める」として先送りした判断は、ここで確定する。JSDoc タグは、静的解析が到達できない事実を機械に渡すときに使う。散文の説明を書く口としては開かない。

あわせて `require-re-export-only-files--move-declaration-to-owning-module` に `targets` を渡す。このルールは opt-in であり、`targets` が空なら `create` が空のビジターを返して何も検査しない。base preset は severity だけを与えて有効にしていたので、有効に見えて 1 件も見ていなかった。`**/index.ts` と `**/index.tsx` を対象にする。

## 影響

`@mst/lint-rule-authoring` が出すものは 7 つ（`oxlint`、`firstToken`、`matchesGlobSegment`、`createWorkspaceLintRule`、`WorkspaceLintRule`、`LINT_SEVERITY`、`testLintRule`）に、`@mst/dont-review-it` が出すものは `oxlint` 1 つになった。いずれも他のワークスペースから実際に import されているものだけである。

barrel に行を足すと、その行が外から使われるまで knip が落ちる。`index.ts` に再エクスポート以外の文を書くと lint が落ちる。公開面が広がる方向の変更には、使う側の変更が同時に要る。

`--production` は採らない。このモードは test とツール設定からの参照を数えないため、`testLintRule` と `oxlint` が未使用として出る。lint 基盤にとってテストと設定から使われることは正常な状態であり、それを異常として報告するモデルは合っていない。

## 検討して採らなかった案

**`ignoreExportsUsedInFile` を true にする。** `plugin.ts` の default export は自ファイル内でも使われていないので、これでは消せない。むしろ「同じファイルの中でしか使われていないのに export している」という、今回 3 件見つかった型がすべて見えなくなる。

**`plugin.ts` を knip の `ignore` に入れる。** ファイル単位で検査から外れる。`plugin.ts` は default export のほかに `noDuplicatedBody` / `noLocalFiniteValueSet` / `noStrictCanonicalLiteralUse` を出しており、これらは `configs/oxlint.ts` が import している。将来この 3 つが使われなくなっても報告されなくなるので、1 件の偽陽性を消すために 3 件の検出を捨てることになる。

**`targets` をルート の `vite.config.ts` に書く。** ルールの文書は「どのファイルが面なのかを決めるのは利用側」と書いており、そちらのほうが筋は通る。それでも base preset に置いたのは、preset が既に `SHARED_TSCONFIG_PRESETS` のようなリポジトリ横断の約束を持っており、有効化と設定が同じ場所にあるほうが「有効なのに何も見ていない」状態に戻りにくいためである。利用側は `rules` で上書きできる。
