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
- IF: `vite.config.ts` に集約できない道具の設定を書く; THEN
  - MUST: その道具が読む TypeScript の綴りに置く
    - knip なら `knip.ts` になる
  - PROHIBIT: JSON / JSONC / JavaScript の綴りに置く
    - 型検査もフォーマッタも lint も届かない設定になる
- IF: AI 向けの指示を置く; THEN
  - MUST: `AGENTS.md` を実体とし、`CLAUDE.md` を同じディレクトリの `AGENTS.md` を指すシンボリックリンクにする
  - PROHIBIT: `CLAUDE.md` に中身を書く
- IF: lint の重大度を読む; THEN MUST: warn を人間に確認せず無視してよいもの、error を基本的にすべて解消するものとして扱う
- IF: lint ルールを追加する; THEN
  - MUST: error で追加する
  - MUST: 追加した時点で出た error をすべて解消してから merge する
  - PROHIBIT: 自分の判断で warn にする
    - warn にするかは人間が決める
- IF: 自前のルールを書いた; THEN MUST: 出荷する preset に載せるかを決める
  - IF: 有効にするかどうかが採用者の構成についての判断になる; THEN
    - MAY: 載せない
    - MUST: ルールの meta に載せない宣言を書く
    - MUST: ルールの文書に載せない理由を節として書く
      - 宣言だけでは、配線を忘れたルールと見分けが付かない
  - IF: それ以外; THEN MUST: 載せる
  - PROHIBIT: 出た違反を直したくないことを理由に載せるのをやめる
    - 載せない判断は、そのルールが守る不変条件を採用者が選べることについてのものであって、違反の件数についてのものではない
- IF: 守りたい不変条件に対してルールを用意する; THEN
  - MUST: 同じ不変条件を守る公式ルール（oxlint の組み込みと同梱プラグイン）を先に探す
  - MUST: 組み込みのルール、同梱プラグインのルール、自前のルールの順に検討する
  - PROHIBIT: 公式ルールで守れる不変条件を自前ルールとして書く
- IF: 公式ルールの報告文を読んでも、何を直せばよいかが決まらない; THEN
  - MAY: その不変条件だけ自前ルールとして書く
    - 判定の精度ではなく報告文で決める。精度は上流が上げるが、報告文は上流が上げない
  - MUST: 書いたら、同じ不変条件を見ている公式ルールを off にする
    - 権威が 2 つあると同じ違反が 2 回報告され、どちらを黙らせるかを書き手が選べてしまう
- IF: 依存のバージョンを書く; THEN
  - MUST: 1 つのリリースに定まる版を書く
  - PROHIBIT: 範囲で書く
    - どのリリースが入るかを決めるのがロックファイルになり、宣言だけを読んでも答えが 1 つに決まらなくなる
  - 範囲のままにする依存は `no-version-range--pin-the-exact-version` の `intentionalRanges` に登録する
- IF: 複数のワークスペースが同じ依存を使う; THEN
  - MUST: バージョンを `pnpm-workspace.yaml` の catalog に集約し、各ワークスペースから `catalog:` で参照する
- IF: 依存を使うワークスペースが 1 つだけ; THEN
  - MUST: そのワークスペースの `package.json` にバージョンを直接書く
  - PROHIBIT: catalog に載せる
    - 共有していないバージョンが catalog に混ざると、どの依存を揃えるべきかが catalog から読めなくなる
  - 例外は overrides が `catalog:` で参照する依存（`vite` など）で、使用箇所の数に関わらず catalog に置く
- IF: Node のバージョンを固定する; THEN
  - MUST: `package.json` の `devEngines.runtime` に置き、`onFail` を `error` にする
  - PROHIBIT: `.node-version` や `.tool-versions` を置く
- IF: node 以外のツールを pin する; THEN
  - MUST: `mise.toml` を追加する
  - PROHIBIT: `mise.toml` に node を書く
- IF: `vite` の依存を整理する; THEN
  - PROHIBIT: ルートと `packages/repository-checks` の `vite` 直接依存を削除する
  - PROHIBIT: `knip.ts` の `ignoreDependencies` から `vite` を外す
- IF: カバレッジ担保のテストを置く; THEN
  - MUST: 対象ソースと同じディレクトリに `<ソース名>.test.ts` として置く
  - PROHIBIT: `tests/` `test/` `__tests__/` `spec/` を作る
- IF: 仕様担保のテストを置く; THEN
  - MUST: パッケージ直下の `specs/` に `<機能名>.spec.ts` として置く
  - MUST: 書き方を `packages/verified-specifications/AGENTS.md` に従わせる
- IF: テストの実行経路を決める; THEN MUST: main に入るすべての経路が通るまとまりに含める
- IF: main への merge を判断する; THEN
  - MUST: 各パッケージの `SPECIFICATIONS.md` の diff を何よりも先に読み、主張の変化をすべて承認してから merge する
    - この diff がリポジトリの約束の変化そのものであり、ここを読み飛ばした merge は仕様の変更を無審査で通す
  - PROHIBIT: `SPECIFICATIONS.md` に diff が出ているのに読まずに merge する
  - MAY: それ以外のテストの diff は読まない
    - カバレッジ担保テストの中身は guard が守るもので、merge の判断材料ではない
- IF: `package.json` の依存や `devEngines` を変更した; THEN MUST: コミット前に `vp install --frozen-lockfile` が通ることを確認する
- IF: 公開パッケージの `version` を上げる; THEN
  - MUST: 同じ変更で `skills/CHANGELOG.md` にその版の見出しを書く
  - PROHIBIT: SKILL.md の `metadata.library_version` を手で書き換える
    - マニフェストから一意に決まる値で、`vp run guard:fix` が揃える
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
- IF: 何かを計測する; THEN
  - MUST: OpenTelemetry の信号として出す
  - MUST: 送り先の既定を、`compose.yaml` が立てる手元の grafana-lgtm にする
  - PROHIBIT: 計測した値を独自の形式で出力して読む
    - 形式ごとに読み方を作ることになり、別々に測った値を突き合わせられなくなる
- IF: 計測を仕込む場所を決める; THEN
  - MUST: 時間を使っている当人に仕込む
  - PROHIBIT: 呼び出し側でコマンドを包んで測る
    - 包み忘れた経路が計測から静かに漏れ、漏れていることは計測結果からは読めない

## 開発コマンド

`vp <name>` は組み込みコマンド、`vp run <name>` は `package.json` のスクリプトまたは `vite.config.ts` のタスク。組み込みをスクリプトで上書きすることはできない。

- `vp check` — format・lint・型検査（`--fix` で自動修正）
- `vp run -r test` — 全ワークスペースのテスト
- `vp run -r build` — 全ワークスペースのビルド
- `vp run knip` — 未使用の依存・export・ファイルの検出
- `vp run dev` — 開発サーバー（`apps/website`）
- `vp run guard` — CI とフックが呼ぶ唯一のゲート。何を実行するかは `package.json` の `guard` が持つ
- `vp run guard:fix` — 自動で直せるものを直し、生成部分を更新する

## どこに時間がかかっているかを見る

何がどれだけ遅いかを知りたいときだけ使う。既定では何も測らず何も送らない。

1. `docker compose up -d` で受け皿を起動する
2. `MST_TELEMETRY=1 OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 vp run guard` を実行する
3. <http://localhost:3000> を開き、Tempo で 1 本のトレースとして読む

有効にしたまま受け皿を止めていると、包んだコマンドは失敗する。観測しているつもりで何も残らない状態を避けるためで、止めたいときは有効化の環境変数を外す。

`spool` が包んだコマンドはスパンになり、子プロセスへは trace context が環境変数で渡る。ゲートの各ステップ、各ワークスペースのテスト、lint のステージ、vitest のテストファイルとテストケースが、1 本のトレースの中で入れ子になる。同じ実行から `command.duration` と `lint.rule.duration` の分布、コマンドの記録本文が LogRecord として出る。

Grafana へは `.mcp.json` が繋ぐ MCP サーバーから問い合わせられる。トレースの検索には Tempo が持つ MCP を使い、`compose.yaml` がそれを有効にしている。

判断は [EDR 0021](docs/engineering-decision-logs/0021-measure-our-own-lint-rules-and-let-the-user-choose-the-sink.md) と [EDR 0064](docs/engineering-decision-logs/0064-carry-one-trace-through-the-gate-and-let-the-agent-query-it.md) にある。

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
