# 0004. 自前 lint ルールの土台を道具の制約に合わせて最小の形にする

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

自前の lint ルールを書き始めるにあたり、ルールを書く行為そのものを支える `@mst/lint-rule-authoring` と、ルールを置く `@mst/dont-review-it` の 2 パッケージを立てた。

土台の形は、好みではなく道具の制約で決まった部分が大きい。oxlint の JS plugin API が持つ型、CI が check → test → build の順に走ること（[0002](0002-place-quality-gates.md)）、`RuleTester` の既定のパース設定。どれも、できあがったコードを読むだけでは「なぜ素直な形になっていないのか」が見えない。

## 決定

**ルールの入力型を oxlint の `Rule` 型と交差させない。** `packages/lint-rule-authoring/src/create-workspace-lint-rule.ts` の `WorkspaceLintRule` は、`name` / `meta` / `create` を直接宣言した独立の型にしてある。交差させると `RuleTester.run` に渡すところで TS2321 Excessive stack depth comparing types が出る。`Rule` が `CreateRule | CreateOnceRule` のユニオンで、AST の visitor 型が巨大かつ再帰的なため、交差型の構造比較が型検査器の再帰上限に達する。必要なフィールドを直接宣言した独立の型にすることで解消した。

上流の型をまったく参照していないわけではない。`create` は `CreateRule["create"]` を、`meta` の `type` / `schema` / `fixable` / `hasSuggestions` は `RuleMeta` の対応するフィールドを借りている。避けたのは型全体の交差だけである。

**ルール定義の受け口はオーバーロードを持たない総称関数 1 本にする。** mst のツールチェーンには oxlint の JS plugin 形式しか存在せず、eslint も構造化データの言語プラグインも入っていない。存在しない形のためにオーバーロードを置くと、使われない分岐が設計に残る。

factory もちょうど 1 つで、ワークスペースのパスを受けてルール変換関数を返す。ワークスペースごとの別名は関数ではなくファイルで持ち、各ワークスペースが自分のパスを渡した呼び出し結果を `src/create-rule.ts` から 1 つ named export する。

**plugin の指定子は dist ではなく src の TypeScript ソースを指す。** 両パッケージの `package.json` の `exports` は `./src/plugin.ts` を指し、`configs/oxlint.ts` の `jsPlugins` はその指定子（`@mst/dont-review-it/plugin` など）を書く。CI は check → test → build の順に走るので、check の時点で dist が存在しない。

**ルールのテスト基盤はパースの既定を TypeScript にする。** `packages/lint-rule-authoring/src/rule-tester.ts` は oxlint 公式の `RuleTester` を `vite-plus/test` の `describe` / `it` に配線したうえで、`languageOptions.parserOptions.lang` に `"ts"` を渡す。既定の JS パースでは型注釈を含むコード片が Parsing failed になり、テストが書けない。

## 影響

`createOnce` 形式のルールは受け付けない。必要になったら、型を組み直すところから始まる。

土台の型は oxlint の `Rule` の形の変化に自動では追随しない。追随するのは、上で挙げた借りているフィールドの中身だけである。

ワークスペース内では指定子と `bin` が src を指すので、check と test は build 前でも動く。`vp pack` は tsdown の `exports.devExports` から `publishConfig.exports` と `publishConfig.bin` を生成し、pnpm が pack する manifest だけを dist へ差し替える。公開パッケージをインストールした利用者は node_modules 内の TypeScript ではなく、生成済みの JavaScript を解決する。

実行基盤の singleton へ結合する公開入口は、その基盤を bundle しない。`@mst/dont-review-it/vitest` は利用者が起動した Vitest と同じ `vite-plus` を peer dependency から解決する。別の Vitest を成果物へ含めると、テストブロックが runner の current suite に到達しないためである。

文書の在り処はワークスペースの位置とルール名から機械的に決まるので、ルールの作者がパスを書くことはない。URL の基点は manifest の `repository` フィールドから導出している。

## 検討して採らなかった案

**同じ変換をワークスペースごとの別名で複数の関数として出す。** どちらを使うべきかが設計上の曖昧さになる。ワークスペースごとの区別はファイルで持てば足りる。

**文書 URL の基点を定数として別に持つ。** リポジトリの所在の宣言が manifest と定数の 2 箇所に分かれて drift する。
