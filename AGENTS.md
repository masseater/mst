---
description: mst のリポジトリ運用規約
---

# AGENTS.md

## プロジェクト概要

mst は、リポジトリ運用の仕組みを再利用可能な単位として整備していくリポジトリ。現時点では Vite+ による土台が立ったところ。

規範の書き方は `docs/normative-notation.md` に従う。

この文書はリポジトリの運用規約を持つ。実装とレビューで個々の判断をどう下すかは `docs/guidelines/` が持つ。

## 規約

- IF: ツールチェーンに関わる道具を選ぶ; THEN MUST: Vite+（vite-plus）に一本化する
  - `vp` はグローバル CLI、`vite-plus` はプロジェクトローカルの devDependency
- IF: `vp` を導入する; THEN
  - MUST: 公式インストーラ（`curl -fsSL https://vite.plus | bash`）を使う
  - PROHIBIT: npm 経由（`npm i -g vite-plus`、mise の `npm:vite-plus`）で導入した `vp` を使う
- IF: ツールの設定を書く; THEN
  - MUST: `vite.config.ts` に集約する
  - PROHIBIT: `oxlint.config.ts` / `.oxlintrc.json` / `.oxfmtrc.json` / `vitest.config.ts` を作る
- IF: lint の重大度を読む; THEN MUST: warn を人間に確認せず無視してよいもの、error を基本的にすべて解消するものとして扱う
- IF: lint ルールを追加する; THEN
  - MUST: error で追加する
  - MUST: 追加した時点で出た error をすべて解消してから merge する
  - PROHIBIT: 自分の判断で warn にする
    - warn にするかは人間が決める
- IF: 依存のバージョンを宣言する; THEN
  - MUST: `pnpm-workspace.yaml` の catalog に集約する
  - MUST: 各ワークスペースから `catalog:` で参照する
- IF: Node のバージョンを固定する; THEN
  - MUST: `package.json` の `devEngines.runtime` に置き、`onFail` を `error` にする
  - PROHIBIT: `.node-version` や `.tool-versions` を置く
- IF: node 以外のツールを pin する; THEN
  - MUST: `mise.toml` を追加する
  - PROHIBIT: `mise.toml` に node を書く
- IF: `vite` の依存を整理する; THEN
  - PROHIBIT: ルートと `packages/utils` の `vite` 直接依存を削除する
  - PROHIBIT: `knip.json` の `ignoreDependencies` から `vite` を外す
- IF: テストを置く; THEN
  - MUST: 対象ソースと同じディレクトリに `<ソース名>.test.ts` として置く
  - PROHIBIT: `tests/` `test/` `__tests__/` `spec/` を作る
  - PROHIBIT: `.spec.ts` を使う
- IF: テストの実行経路を決める; THEN
  - MUST: CI で実行する
  - PROHIBIT: pre-push に含める
- IF: `package.json` の依存や `devEngines` を変更した; THEN MUST: コミット前に `vp install --frozen-lockfile` が通ることを確認する
- IF: `.github/workflows/ci.yml` の `voidzero-dev/setup-vp` を書く; THEN
  - MUST: commit SHA で固定する
  - MUST: コメントにタグを書く
- IF: スキャフォールド生成物に問題が出た; THEN
  - PROHIBIT: 独自設計に置き換える
  - MUST: [voidzero-dev/vite-plus](https://github.com/voidzero-dev/vite-plus/issues) の issue を調べる
- IF: 関数を実装する; THEN
  - MUST: 同じ処理が [es-toolkit](https://github.com/toss/es-toolkit) で提供されていないか先に調べる
  - PROHIBIT: 提供されているものを自前実装する
  - PROHIBIT: `es-toolkit` の関数を包み直すだけのラッパーを作る
- IF: 実装の根拠を書き残す; THEN
  - PROHIBIT: コードコメントに書く
  - MUST: コミットメッセージの本文に残す
- IF: 設計上の意思決定をした; THEN MUST: `docs/engineering-decision-logs/` に残す
  - EDR は architecture に限らず、ツールチェーンの選定・運用方針・依存の扱い方も対象

## 開発コマンド

`vp <name>` は組み込みコマンド、`vp run <name>` は `package.json` のスクリプトまたは `vite.config.ts` のタスク。組み込みをスクリプトで上書きすることはできない。

- `vp check` — format・lint・型検査（`--fix` で自動修正）
- `vp run -r test` — 全ワークスペースのテスト
- `vp run -r build` — 全ワークスペースのビルド
- `vp run knip` — 未使用の依存・export・ファイルの検出
- `vp run dev` — 開発サーバー（`apps/website`）
- `vp run docs` — 規範文書の検査
- `vp run docs:write` — 生成部分の更新
- `vp run ready` — CI と同じ検査をまとめて実行する。何を実行するかは `package.json` の `ready` が持つ

## 自作 lint ルールの実行時間を見る

どのルールが遅いかを知りたいときだけ使う。既定では何も測らず何も送らない。

1. `docker compose up -d` で受け皿を起動する
2. `MST_LINT_RULE_DURATION=1 OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 OTEL_SERVICE_NAME=mst-lint vp lint` を実行する
3. <http://localhost:3000> を開き、`lint_rule_duration_milliseconds_sum` をルール名で集計する

有効にしたまま受け皿を止めていると lint は失敗する。観測しているつもりで何も残らない状態を避けるためで、止めたいときは有効化の環境変数を外す。

`lint_run_duration_milliseconds_sum` は lint 全体の時間で、自作ルールの合計との差が oxlint 本体・型検査・プラグインの橋渡しに使われた時間になる。判断は [EDR 0021](docs/engineering-decision-logs/0021-measure-our-own-lint-rules-and-let-the-user-choose-the-sink.md) にある。

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
