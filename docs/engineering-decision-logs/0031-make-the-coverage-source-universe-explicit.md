# 0031. カバレッジのソース集合を明示する

- ステータス: Accepted
- 日付: 2026-08-11

## 文脈

[0017](0017-demand-full-coverage-in-every-test-config.md) は、全メトリクス 100% と `perFile: true` を各テスト設定へ要求し、テストの無いファイルもゲートで落ちる状態を意図している。

Vitest のカバレッジは、`coverage.include` が無ければ実行中に読み込まれたファイルだけを計測対象にする。テストから import されない production source はレポート自体に現れないため、100% と `perFile: true` のどちらもそのファイルを評価できない。下限を厳しくしても、下限へ入る前のソース集合が部分集合なら未検査のファイルは成功として通る。

## 決定

**各 Vite/Vitest 設定で production source の集合を `test.coverage.include` に明示する。** 既定の必須パターンを `src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}` とする。別の source root を持つ構成では、共有 lint 設定のルールオプションで必須パターンを宣言し、その同じ値を各テスト設定の `include` に置く。

**各テスト設定の `test.coverage.exclude` を禁止する。** 所有する source root が既定より狭い場合は、`include` をその root へ狭める。計測対象へ入った production source を設定ごとの除外で抜く経路は持たない。

**`include` の否定 glob を禁止する。** `!src/uncovered.ts` のような pattern は `exclude` と同じく分母からファイルを引くため、正の pattern としては数えない。必須 pattern を渡すルールオプションにも否定 glob と空文字を受け付けない。

**設定を自作 lint ルール `no-partial-coverage-source-universe--include-production-files` で検査する。** basename が `vite.config` または `vitest.config` で、拡張子が `.js` / `.cjs` / `.mjs` / `.ts` / `.cts` / `.mts` のファイルを対象にする。ESM の default export は静的な object literal か、`vite` / `vite-plus` / `vitest/config` から value import した `defineConfig` に静的な object literal 1 個を渡す形に限る。named import の alias と namespace import は binding から解決し、type-only import、同名のローカル関数、別 module の import は factory とみなさない。実行時の値を変えない TypeScript の `as` / `satisfies` / non-null / angle-bracket assertion は透過して読む。

default export、root、`test`、`coverage`、`include` は静的な object / array literal に限定し、merge call、変数、spread、動的 computed property、非文字列要素を失敗させる。CommonJS の `.cjs` / `.cts` と `module.exports` を使う `.js` は同じ静的 resolver で証明できないため、ESM の canonical config への変換を要求する。実際の到達率は `vp run -r test --coverage` が検査する。

**test command による config の選択と coverage 設定の上書きを check CLI で禁止する。** `--config` / `-c` は、任意名・任意拡張子の設定を CLI 引数で注入し、commit された通常の discovery 経路と lint の対象判定を分離できる。`--coverage.*` と `--coverage=...` は、静的に検査した include、exclude、threshold を実行時に置き換えられる。bare `--coverage` による有効化だけを許可する。

check CLI は workspace 定義の有無にかかわらず root manifest を検査し、workspace 定義があれば recursive glob と否定 pattern を解釈して追加の manifest を検査する。各 workspace の test script は自動発見される設定を使い、lint と coverage 実行が同じ設定を読む。`vite.config` の `run.tasks.test` も manifest の検査を迂回する第2の入口になるため禁止し、変数、spread、computed property で task の有無を隠す構成も失敗させる。

静的な `coverage` object に `include` が無いか、文字列だけの arrayに必須 pattern が不足する場合は自動修正する。動的構成、否定 glob、`exclude` は所有する source root の判断を要し、安全な修正が一意に定まらないため診断だけを出す。

ルートのテスト設定はワークスペースへ伝播しないため、`include` はテストを持つ各ワークスペースの設定に置く。この配置は 0017 の実測結果を引き継ぐ。

この決定は、0017 が `perFile: true` だけで新しい未テストファイルも赤くなるとした帰結を置き換える。100% の下限、`perFile: true`、実行経路は変えない。

## 影響

- テストから import されない production source も 0% のファイルとして報告される
- 公開 entry、設定 preset、CLI entry も source root にあればテストまたは削除が必要になる
- 追加した production source は、他のファイルの高い到達率で埋め合わせられず、レポートから消えることもない
- lint は対象集合の宣言を検査し、coverage provider はその集合に対する実行結果を検査する
- Vite/Vitest が解析する `.cjs` / `.mjs` / `.cts` / `.mts` も既定の production source 集合に入る
- 設定の後段で source universe を上書き・減算する構成は、実効値を静的に証明できないため失敗する
- canonical config を使わない test command と、coverage 設定を CLI で上書きする test command は check CLI で失敗する
- test command を Vite task に置く構成は lint で失敗する

## 検討して採らなかった案

**100% と `perFile: true` だけを維持する。** レポートに入ったファイルには十分だが、読み込まれなかったファイルを評価できないため採らない。

**production source を別の CLI で列挙し、coverage report と突き合わせる。** Vitest が既に `include` から未読ファイルを計測対象へ加えられる。対象集合の解釈を別実装として重ねるため採らない。

**設定ごとの `exclude` で到達不能なファイルを外す。** テストすべきコードと計測から外すコードの境界を各パッケージが別々に持ち、未検査の production source を成功へ戻せるため採らない。
