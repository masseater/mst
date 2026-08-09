# AGENTS.md

このプロジェクトで作業するための必須ガイドライン。

## プロジェクト概要

mst は、リポジトリ運用の仕組みを再利用可能な単位として整備していくリポジトリ。現時点では Vite+ による土台が立ったところ。

## ツールチェーン

Vite+（vite-plus）に一本化している。`vp` はマシンに導入するグローバル CLI、`vite-plus` はプロジェクトローカルの devDependency という 2 部構成をとる。vp は Node.js と pnpm を自前で管理し、`vp env current` は Package Manager として pnpm 11.20.0（Source: `devEngines.packageManager`）を報告する。叩くコマンドは vp だけだが、実体としては pnpm がワークスペースと lockfile を扱っている。

npm 経由（`npm i -g vite-plus` や mise の `npm:vite-plus`）でグローバル導入した vp は使ってはいけない。`vp test` がプロジェクトローカルの vite-plus と二重インスタンスになり、`Vitest failed to find the current suite` で必ず失敗する。上流も [voidzero-dev/vite-plus#2097](https://github.com/voidzero-dev/vite-plus/issues/2097) で「npm でのグローバルインストールは期待されるグローバル CLI ではない」と明言している。

## 構成

### トップレベルディレクトリ

| ディレクトリ                      | 説明                                                           |
| --------------------------------- | -------------------------------------------------------------- |
| `apps/website/`                   | Vite+ テンプレートが生成した web アプリ                        |
| `packages/utils/`                 | Vite+ テンプレートが生成したライブラリパッケージ               |
| `docs/engineering-decision-logs/` | 設計・運用上の意思決定ログ（EDR）                              |
| `.github/`                        | CI ワークフローと Renovate 設定                                |
| `.vite-hooks/`                    | Git フック。リポジトリが所有するのは直下のフックスクリプトのみ |
| `.vscode/`                        | エディタ設定（oxc 拡張をフォーマッタに指定）                   |

### トップレベルファイル

| ファイル              | 説明                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `package.json`        | ルートワークスペースのマニフェスト。`devEngines.packageManager` が pnpm、`engines.node` が Node を宣言する |
| `pnpm-workspace.yaml` | ワークスペース定義と catalog（依存バージョンの一元管理）                                                   |
| `vite.config.ts`      | lint / fmt / staged / run タスクの設定を集約する唯一の設定ファイル                                         |
| `tsconfig.json`       | ルートの TypeScript 設定                                                                                   |
| `knip.json`           | 未使用の依存・export・ファイルの検出設定                                                                   |
| `AGENTS.md`           | AI エージェント向けガイド（このリポジトリの SSOT）                                                         |
| `CLAUDE.md`           | `AGENTS.md` へのシンボリックリンク                                                                         |

### ワークスペース内の規約（`apps/*`, `packages/*`）

| ファイル/ディレクトリ | 説明                                               |
| --------------------- | -------------------------------------------------- |
| `src/`                | ソース                                             |
| `<ソース名>.test.ts`  | テストファイル。対象ソースと同じディレクトリに置く |
| `vite.config.ts`      | そのワークスペース固有の pack / lint / fmt 設定    |
| `tsconfig.json`       | そのワークスペースの TypeScript 設定               |
| `package.json`        | そのワークスペースのマニフェストとスクリプト       |

### Git フックの規約（`.vite-hooks/`）

| ファイル/ディレクトリ | 説明                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `pre-commit`          | `vp staged` を実行し、staged ファイルに `vp check --fix` をかける                                    |
| `pre-push`            | `vp check` を実行する。テストは含まない                                                              |
| `_/`                  | `vp config` が生成するディスパッチャ。`node_modules/.bin` を PATH 先頭に置きローカルの vp を使わせる |

## 開発コマンド

```bash
vp install       # 依存インストール
vp check         # format・lint・型検査をまとめて実行
vp check --fix   # 自動修正込み
vp run -r test   # 全ワークスペースのテスト
vp run -r build  # 全ワークスペースのビルド
vp run knip      # 未使用の依存・export・ファイルの検出
vp run dev       # 開発サーバー起動（apps/website、localhost:5173）
vp run ready     # check → test → build をまとめて実行
```

`vp <name>` は組み込みコマンド、`vp run <name>` は `package.json` のスクリプトまたは `vite.config.ts` のタスクを実行する。両者は別物であり、組み込みをスクリプトで上書きすることはできない。

> Development command last updated: 2026-08-09

## 重要な指示

- 設定は `vite.config.ts` に集約する。`oxlint.config.ts` / `.oxlintrc.json` / `.oxfmtrc.json` / `vitest.config.ts` を作らない（Vite+ が明示的に非推奨としている）
- 依存バージョンは `pnpm-workspace.yaml` の catalog に集約し、各ワークスペースは `catalog:` で参照する
- ルートと `packages/utils` の `vite` 直接依存を「未使用」と判断して削除しない。pnpm では `overrides` が実際の依存エッジを持つワークスペースにしか効かず、直接依存のないワークスペースでは autoInstallPeers が上流の素の vite を別途入れて vite/vitest が二重インスタンス化する。テンプレートがこの依存を入れているのは [voidzero-dev/vite-plus#1932](https://github.com/voidzero-dev/vite-plus/issues/1932) の対策であり、`knip.json` が `vite` を `ignoreDependencies` に入れているのも同じ理由
- テストは対象ソースと同じディレクトリに `<ソース名>.test.ts` として置く。`tests/` `test/` `__tests__/` `spec/` などのディレクトリを作らず、`.spec.ts` も使わない。ルートの `vite.config.ts` にある `vitest/consistent-test-filename` がどちらも error にする。テストの置き場所は `src/` 配下に限らない
- テストは CI で実行する。pre-push には含めない
- スキャフォールド生成物は独自設計に置き換えない。生成物のまま問題が出たら、まず [voidzero-dev/vite-plus](https://github.com/voidzero-dev/vite-plus/issues) の issue を調べる
- 実装の根拠はコードコメントに書かない。なぜそうしたのか、何を検討して採らなかったのかといった経緯はコミットメッセージの本文に残す。コードコメントで説明を代替しない
- コードレベルではなく大きな設計上の意思決定は `docs/engineering-decision-logs/` に markdown ファイルとして残す。EDR（Engineering Decision Log）は ADR（Architecture Decision Record）を含むが architecture に限らず、ツールチェーンの選定・運用方針・依存の扱い方などあらゆる種類の意思決定を対象とする。コミットログに収まらない粒度の判断、後から「なぜこうなっているのか」を辿る必要がある判断がここに来る

## CI

`.github/workflows/ci.yml` が main への push と pull request で `vp check` → `vp run -r test` → `vp run -r build` → `vp run knip` を実行する。`voidzero-dev/setup-vp` は commit SHA で固定し、コメントにタグを書いて Renovate が更新できるようにしている。

## 依存更新

`.github/renovate.json5` が Mend-hosted Renovate App 向けの設定。設定ファイルだけでは動かず、GitHub 側で masseater/mst に App を許可する操作が別途必要になる。

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
