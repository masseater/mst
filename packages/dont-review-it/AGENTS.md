---
description: Machine-enforced answers to the writing questions that would otherwise be raised in review.
---

# @mst/dont-review-it

## このパッケージが守るもの

コードの書き方について、レビューで人間が問い直さずに済む状態。

同じ問いがレビューのたびに立ち、その違反状態を機械が一意に判定できるなら、人間が毎回答えを出す必要はない。ここに入るのは違反かどうかが一意に決まる問いであり、直し方が 1 つに決まる問いだけではない。直し方が複数あっても、破られた不変条件と修正の方向を報告できるなら機械で止める。

## ルールの境界

- IF: ある書き方を禁じたい; THEN
  - MUST: 違反状態を機械が一意に判定できることを先に確かめる
  - MUST: 破られた不変条件と修正の方向を報告する
- IF: 安全で決定的な直し方がちょうど 1 つに定まる; THEN MUST: 自動修正を用意する
- IF: 有効な直し方が複数残る; THEN
  - PROHIBIT: 自動修正を用意する
  - MUST: 失敗するガードとして報告する
    - 直し方の選択と、違反しているかの判定は別である
- IF: 検出できない回避策がある; THEN MUST: 文書の禁止事項として名指しする
  - 検出できないことは許していることを意味しない。この差を文書で埋める

同じ不変条件を守る公式のルールを先に探すこと、どの順に検討するか、自前で書いてよい条件と書いたあとの後始末は [AGENTS.md](../../AGENTS.md) が持つ。

違反の判定と修正案の選択を分ける判断は [EDR 0046](../../docs/engineering-decision-logs/0046-separate-the-violation-from-the-choice-of-repair.md)、Ponytail から機械で決定できる範囲だけを取り込む判断は [EDR 0048](../../docs/engineering-decision-logs/0048-enforce-only-the-decidable-parts-of-ponytail.md) が持つ。

## 文書

ルールごとに `docs/lint/<ルール名>.md` を持つ。何を検出するか、なぜそれが要るか、どう直すか、どんな回避策を禁じるかを書く。報告メッセージには禁止と修正の方向だけを載せ、理由と修正の選択肢は文書側が持つ。

説明に載せる例をどこから作るかは [文書](../../docs/guidelines/documents.md) が持つ。良い例と悪い例を対で置かないことは [規範の書き方](../../docs/normative-notation.md) が持つ。

## 公開する config

公開する oxlint の config は `oxlint` の 1 枚だけである。対象種別による出し分けはしない。ルートの `lint` が `extends` した時点でリポジトリ全体に効き、採用の判断は残らない。CLI に固有の規律もこの中にあり、対象を絞るのはルールの側である。判断は [EDR 0042](../../docs/engineering-decision-logs/0042-apply-one-preset-at-the-root-and-report-the-exception-the-toolchain-forces.md) にある。

lint で検出できない CLI の規範は [CLI の作り方](docs/cli.md) が持つ。

## 検証コマンド

lint ルールとして書けない検査は CLI として持つ。マニフェストや複数ファイルをまたぐ突き合わせと、lint のツールチェーンが解釈できない形式が該当する。

CLI が持つコマンドは `check` の 1 つで、そこが全部の検査を走らせる。1 件でも見つかれば非ゼロで終わる。

- IF: 検査が 1 ファイルの構文で完結しない; THEN MUST: lint ルールではなく CLI の検査として持つ
- IF: 検査対象の形式を lint のツールチェーンが解釈できない; THEN MUST: 同じく CLI の検査として持つ
- IF: 検査を足す; THEN
  - MUST: `check` が走らせる一覧に載せる
  - PROHIBIT: 2 つ目のサブコマンドを作る
    - 呼ぶ側が入口を選べると、載せ忘れた検査が「あるのに走らない」状態で残る
- IF: 検査が違反を見つけた; THEN
  - MUST: 非ゼロで終わらせる
  - PROHIBIT: 報告だけ出してゼロで終わる
    - 報告が出るのに通る検査は、ゲートに名前があるだけの状態になる

## ワークフロー定義の検査

`check` が `.github/workflows/` の定義も読む。守っているのは [強制の機構](../../docs/guidelines/enforcement.md) と [秘密と権限](../../docs/guidelines/secrets-and-permissions.md) に既に書かれている規範で、この検査はその強制側にあたる。

- 読めない定義が残っていない
- ゲートとして要求されうる実行単位が、起動の条件で自分を絞り込んでいない
- 呼び出される部品が、自分を起動するトリガを持っていない
- 実行単位が、別の実行単位の結果を受け取って起動していない
- ジョブが、宣言されていない既定の権限で走っていない
- 実行ブロックが、1 つのコマンド呼び出しを超えていない
- 失敗を成功に読み替える記述が置かれていない

- IF: 上流に同じ形式を対象にする既製の検査を入れる; THEN
  - MUST: 既製の側が覆う不変条件をこの検査から外す
  - PROHIBIT: 同じ違反を 2 つの経路から報告する
- IF: 構文・式の注入・ランナー名・アクションの入力名を検査したくなった; THEN MUST: この検査に足さず、その層を持つ既製の検査を導入する判断から始める
  - この検査が持たない範囲であることは [EDR 0025](../../docs/engineering-decision-logs/0025-check-workflow-definitions-with-our-own-policy-layer.md) が決めている

## 依存宣言の検査

`check` が `pnpm-workspace.yaml` と、そこに宣言されたワークスペースの `package.json` も読む。守っているのは「catalog は複数のワークスペースが共有するバージョンだけを持つ」という規範で、配置の判断は [EDR 0028](../../docs/engineering-decision-logs/0028-keep-the-catalog-for-shared-versions-only.md)、修正案が複数あっても違反を error にする判断は [EDR 0046](../../docs/engineering-decision-logs/0046-separate-the-violation-from-the-choice-of-repair.md) にある。

- 読めないワークスペース定義が残っていない
- 1 つのマニフェストしか使わない catalog エントリが残っていない。overrides が `catalog:` で参照するエントリは除く
- catalog が持つバージョンを、マニフェストが直接書き写していない
- 複数のマニフェストが同じバージョンを catalog の外で繰り返していない
- バージョンが食い違う宣言も失敗として出す。どのバージョンへ揃えるかは人が選び、選んだバージョンを catalog に置いて全マニフェストから参照する
- 何も使っていない catalog エントリは報告しない。未使用の検出は knip が持つ

## テスト設定と実行経路の検査

`check` はワークスペース定義の有無にかかわらずルートの `package.json` を読み、定義があれば一致するワークスペースの `package.json` も読む。lint は Vite/Vitest 設定を静的に検査する。coverage の source universe を明示する判断は [EDR 0047](../../docs/engineering-decision-logs/0047-make-the-coverage-source-universe-explicit.md)、manifest の列挙方法は [EDR 0049](../../docs/engineering-decision-logs/0049-use-node-globs-for-workspace-manifests.md) が持つ。

- test command が `--config` / `-c` で別の設定を選んでいない。test 設定は自動発見される `vite.config` / `vitest.config` に置く
- test command が bare `--coverage` 以外の coverage CLI option で静的設定を上書きしていない。coverage の lint と実行時ゲートは同じ source universe と threshold を読む
- test config を持つ workspace が文字列の `scripts.test` を持ち、現在packageの通常test runを1回だけ静的に露出する。`spool -- vp test` を標準形とし、直接Vitestを使う場合は`vitest run`または`./node_modules/.bin/vitest run`とする。runner引数は任意のbare `--coverage` 1個以外を置かない。`--changed` / `--changed=...`、`pretest` / `posttest`、環境・cwd・workspace・package・binary解決を変えるwrapper、package-manager / Vite Plus exec、別root / project、watchを含む非run mode、任意pathの実行ファイル、parameter / command / pathname / brace expansion、`env -S`、未知のwrapper、shell mode、control operator、別名のscriptへの委譲を置かない
- root の `scripts.guard` が `throttle --timeout 1800 -- spool -- vp run guard:all` だけを実行し、引数や別commandを足さない
- root の `scripts.guard:all` が静的なcommandを `&&` だけでつなぎ、`vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2` をちょうど1回直接実行する。task名より後ろは各packageのtest scriptへ転送されるため、rootから渡すrunner引数はcoverageの有効化とworker上限だけに固定する
- canonical な `vite.config` / `vitest.config` が ESM の静的な object literal、または正規 module から import した `defineConfig({...})` として書かれている。CommonJS と動的な合成は source universe と threshold の証明を妨げる
- canonical config に top-level `root` が存在しない。config と source discovery は package root を基準にし、所有する production source は `test.coverage.include` で宣言する
- canonical config の `test.changed` と `test.coverage.changed` は literal `false` または空文字だけを許す。`true` と空でない ref は削除し、動的な値は実効値を証明できる静的宣言へ直す
- `run.tasks.test` が存在しない。test の入口は `package.json#scripts.test` に置き、config と coverage override の CLI 検査を必ず通す

## preset の適用範囲の検査

`check` が、ルートのツールチェーン設定とワークスペースの一覧を突き合わせる。preset を `extends` した時点で全体に効くという前提が、実際に成り立っているかを見る。

`vite.config.ts` があるなら、`@mst/dont-review-it` の値 export `oxlint` を静的 import し、root の `lint.extends` から直接ちょうど 1 回参照する。named alias と namespace は許す。type-only import、別 module、dynamic import、local relay、computed member、spread、重複は採用として扱わない。ツールチェーン設定が無いリポジトリでは導入を要求しない。

設定を読んで `off`、`allow`、数値 `0` にされている preset のルールと、それらを先頭に置く配列を拾う。`rules`、`overrides`、severity、`files`、`excludeFiles` の有効値を静的に読めない設定も problem にする。EDR 0042 が記録する 1 rule と 2 workspace の完全一致だけを warning に留め、それ以外の disabled declaration は problem にする。preset の外のルールは見ない。

- IF: preset のルールを `overrides` で止める; THEN
  - MUST: 止めた理由を EDR に残す
  - MUST: EDR に記録した rule と path の完全一致だけを残す
- IF: warning が指すワークスペースを preset の下に戻せた; THEN MUST: disabled declaration を消す
  - 残った例外は、いつか誰かが「元からそうだった」として読む

## 公開パッケージの skill の検査

`check` が、TanStack Intent の skill と package.json の宣言が食い違っていないことも読む。見るのは同梱と配布の配線だけで、両方向を検知する。

npm へ公開できるパッケージには、あることを要求する。

- `skills/**/SKILL.md` が 1 つ以上ある
- `files` の許可リストがあるなら `skills` を載せている
- `keywords` が `tanstack-intent` を含んでいる

`private: true` のパッケージには、同じ 3 点が書かれていないことを要求する。出荷されない skill と、出荷されない前提の配線は、読む側に嘘を教える。

- IF: SKILL.md の中身の構造を検査したくなった; THEN MUST: この検査に足さず、上流の `intent validate`（各パッケージの `check:skills`）に任せる
  - 不変条件の分担は [EDR 0030](../../docs/engineering-decision-logs/0030-ship-agent-skills-with-published-packages-and-gate-the-shipping-ourselves.md) が決めている
