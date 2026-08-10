# AGENTS.md

## プロジェクト概要

mst は、リポジトリ運用の仕組みを再利用可能な単位として整備していくリポジトリ。現時点では Vite+ による土台が立ったところ。

## 規約

- ツールチェーンは Vite+（vite-plus）に一本化する。`vp` はグローバル CLI、`vite-plus` はプロジェクトローカルの devDependency
- `vp` は公式インストーラ（`curl -fsSL https://vite.plus | bash`）で導入する。npm 経由（`npm i -g vite-plus`、mise の `npm:vite-plus`）で導入した `vp` は使わない
- 設定は `vite.config.ts` に集約する。`oxlint.config.ts` / `.oxlintrc.json` / `.oxfmtrc.json` / `vitest.config.ts` を作らない
- lint の重大度は、warn を人間に確認せず無視してよいもの、error を基本的にすべて解消するものとして扱う
- 依存バージョンは `pnpm-workspace.yaml` の catalog に集約し、各ワークスペースは `catalog:` で参照する
- Node のバージョンは `package.json` の `devEngines.runtime` に置き、`onFail` は `error` にする。`.node-version` や `.tool-versions` は置かない。node 以外のツールを pin するときは `mise.toml` を追加し、そこに node は書かない
- ルートと `packages/utils` の `vite` 直接依存を削除しない。`knip.json` の `ignoreDependencies` から `vite` を外さない
- テストは対象ソースと同じディレクトリに `<ソース名>.test.ts` として置く。`tests/` `test/` `__tests__/` `spec/` を作らず、`.spec.ts` も使わない
- テストは CI で実行する。pre-push には含めない
- `package.json` の依存や `devEngines` を変更したら、コミット前に `vp install --frozen-lockfile` が通ることを確認する
- `.github/workflows/ci.yml` の `voidzero-dev/setup-vp` は commit SHA で固定し、コメントにタグを書く
- スキャフォールド生成物は独自設計に置き換えない。問題が出たら [voidzero-dev/vite-plus](https://github.com/voidzero-dev/vite-plus/issues) の issue を調べる
- 関数を実装する前に、同じ処理が [es-toolkit](https://github.com/toss/es-toolkit) で提供されていないか調べる。あれば自前実装せずそれを使い、`es-toolkit` の関数を包み直すだけのラッパーも作らない
- 実装の根拠をコードコメントに書かない。経緯はコミットメッセージの本文に残す
- 設計上の意思決定は `docs/engineering-decision-logs/` に残す。EDR は architecture に限らず、ツールチェーンの選定・運用方針・依存の扱い方も対象

## 開発コマンド

`vp <name>` は組み込みコマンド、`vp run <name>` は `package.json` のスクリプトまたは `vite.config.ts` のタスク。組み込みをスクリプトで上書きすることはできない。

| コマンド          | 内容                                       |
| ----------------- | ------------------------------------------ |
| `vp check`        | format・lint・型検査（`--fix` で自動修正） |
| `vp run -r test`  | 全ワークスペースのテスト                   |
| `vp run -r build` | 全ワークスペースのビルド                   |
| `vp run knip`     | 未使用の依存・export・ファイルの検出       |
| `vp run dev`      | 開発サーバー（`apps/website`）             |
| `vp run ready`    | check → test → build → knip。CI と同じ     |

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
