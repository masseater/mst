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

違反の判定と修正案の選択を分ける判断は [EDR 0058](../../docs/engineering-decision-logs/0058-separate-the-violation-from-the-choice-of-repair.md)、Ponytail から機械で決定できる範囲だけを取り込む判断は [EDR 0060](../../docs/engineering-decision-logs/0060-enforce-only-the-decidable-parts-of-ponytail.md) が持つ。

## 文書

ルールごとに `docs/lint/<ルール名>.md` を持つ。何を検出するか、なぜそれが要るか、どう直すか、どんな回避策を禁じるかを書く。報告メッセージには禁止と修正の方向だけを載せ、理由と修正の選択肢は文書側が持つ。

説明に載せる例をどこから作るかは [文書](../../docs/guidelines/documents.md) が持つ。良い例と悪い例を対で置かないことは [規範の書き方](../../docs/normative-notation.md) が持つ。

## 公開する config

公開する config は `dontReviewItPreset` の 1 つだけである。`fmt` と `lint` の 2 つの関数を持ち、ルートの `vite.config.ts` はそれぞれのブロックで対応する関数を呼ぶ。呼び出し側が足したいものは引数に渡し、preset が返した値へ後ろから重なる。呼び忘れは [no-unwrapped-toolchain-config--call-the-preset-for-the-block](docs/lint/no-unwrapped-toolchain-config--call-the-preset-for-the-block.md) が報告する。

`lint` が配るルール集合は 1 枚だけである。対象種別による出し分けはしない。ルートの `lint` が呼んだ時点でリポジトリ全体に効き、採用の判断は残らない。CLI に固有の規律もこの中にあり、対象を絞るのはルールの側である。判断は [EDR 0042](../../docs/engineering-decision-logs/0042-apply-one-preset-at-the-root-and-report-the-exception-the-toolchain-forces.md) にある。

`fmt` が決めているのは、整形結果が読み手に届く見た目を変えず、差分にだけ現れる書き方である。markdown の段落を 1 行に畳むこと、import の並び順がこれにあたる。判断は [EDR 0046](../../docs/engineering-decision-logs/0046-let-the-formatter-own-where-markdown-lines-break.md) と [EDR 0047](../../docs/engineering-decision-logs/0047-hand-every-toolchain-block-one-preset-function.md) にある。

- IF: 整形の選択を `fmt` に足したい; THEN
  - MUST: レンダリングされた結果が変わらないことを確かめる
  - PROHIBIT: 読み手に届く見た目を変える選択を入れる
    - 見た目が変わる選択は書き手の判断であり、機械が一律に決めると表現を奪う
- IF: 公開する config を増やしたくなった; THEN
  - MUST: `dontReviewItPreset` の中へ入れる
  - PROHIBIT: 2 つ目の export を作る
    - 入口が複数あると、どれを配線したかで効いている範囲が変わり、採用の判断が呼び出し側に戻る

lint で検出できない CLI の規範は [CLI の作り方](docs/cli.md) が持つ。

## 検証コマンド

lint ルールとして書けない検査は CLI として持つ。マニフェストや複数ファイルをまたぐ突き合わせと、lint のツールチェーンが解釈できない形式が該当する。

CLI が持つコマンドは `check` の 1 つで、そこが全部の検査を走らせる。違反として problem が 1 件でも見つかれば非ゼロで終わる。正当な状態を人へ並べる inventory と EDR が受理した完全一致の例外だけは warning として区別する。

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

## 語彙カタログの検査

`check` が `@canonical-values` の注釈を持つ宣言を読み、カタログを組む。守っているのは「有限個の値からなる語彙はリポジトリのどこか 1 箇所で宣言され、他の全箇所はそこから導出する」という規範で、強制の本体は [no-local-finite-value-set--use-or-register-canonical-values](docs/lint/no-local-finite-value-set--use-or-register-canonical-values.md) と [no-strict-canonical-literal-use--use-canonical-import](docs/lint/no-strict-canonical-literal-use--use-canonical-import.md) の 2 本が持つ。

注釈と宣言の対が壊れている、概念 id が重複している、廃止されたタグが残っている、といった事象は落とす。直し方が 1 つに決まるため。

値集合が同一の概念が複数あることは落とさず、警告として並べる。

- IF: 値集合が同じ概念が 2 つ以上ある; THEN
  - MUST: 警告として全部を並べる
  - PROHIBIT: 落とす
    - 同じ値集合を持つ概念が並ぶことは正当な状態である。所有者も変更理由も違う語彙がたまたま同じ綴りを持つことがあり、畳むべきかどうかは周囲の振る舞いを見なければ決まらない。落とすと、片方を登録しないことで報告を消す動機が生まれ、消費側の強制がそこだけ効かなくなる
- IF: 同じ綴りが複数の概念に属する; THEN
  - MUST: 全部を所有者として登録する
  - PROHIBIT: 片方の登録を見送って報告を減らす
    - その概念でない綴りは、それ自身が別の概念である

## ワークフロー定義の検査

`check` が `.github/workflows/` の定義も読む。守っているのは [強制の機構](../../docs/guidelines/enforcement.md) と [秘密と権限](../../docs/guidelines/secrets-and-permissions.md) に既に書かれている規範で、この検査はその強制側にあたる。

- 読めない定義が残っていない
- ゲートとして要求されうる実行単位が、起動の条件で自分を絞り込んでいない
- 呼び出される部品が、自分を起動するトリガを持っていない
- 実行単位が、別の実行単位の結果を受け取って起動していない
- ジョブが、宣言されていない既定の権限で走っていない
- 実行ブロックが、1 つのコマンド呼び出しを超えていない
- 失敗を成功に読み替える記述が置かれていない
- アクションの参照が、可変な名前ではなくコミットハッシュで終わり、版を書いた注釈を伴っている
- チェックアウトが、履歴を全部取りにいっていない

同じ入口が、リポジトリに 1 つしかないものも読む。定義の数と対応しないので、観点は分けて数える。

- 固定した参照を引き上げる機構が、リポジトリに繋がっている

- IF: 上流に同じ形式を対象にする既製の検査を入れる; THEN
  - MUST: 既製の側が覆う不変条件をこの検査から外す
  - PROHIBIT: 同じ違反を 2 つの経路から報告する
- IF: 構文・式の注入・ランナー名を検査したくなった; THEN MUST: この検査に足さず、その層を持つ既製の検査を導入する判断から始める
  - この検査が持たない範囲であることは [EDR 0025](../../docs/engineering-decision-logs/0025-check-workflow-definitions-with-our-own-policy-layer.md) が決めている
- IF: アクションの入力を検査したくなった; THEN MUST: 判定にそのアクションの定義が要るかで決める
  - 定義が要るなら持たない。要らないなら持つ
  - 線の引き方は [EDR 0039](../../docs/engineering-decision-logs/0039-pin-action-references-and-bound-the-history-a-run-fetches.md) が決めている
- IF: 参照が最新の版かを検査したくなった; THEN
  - MUST: 追随する機構が繋がっていることの検査に留める
  - PROHIBIT: 検査の中から上流へ問い合わせる
    - 手元の入力だけで結果が決まらなくなり、同じコミットへの判定が日によって変わる

## 依存宣言の検査

`check` が `pnpm-workspace.yaml` と、そこに宣言されたワークスペースの `package.json` も読む。守っているのは「catalog は複数のワークスペースが共有するバージョンだけを持つ」という規範で、配置の判断は [EDR 0028](../../docs/engineering-decision-logs/0028-keep-the-catalog-for-shared-versions-only.md)、修正案が複数あっても違反を error にする判断は [EDR 0058](../../docs/engineering-decision-logs/0058-separate-the-violation-from-the-choice-of-repair.md) にある。

- 読めないワークスペース定義が残っていない
- 1 つのマニフェストしか使わない catalog エントリが残っていない。overrides が `catalog:` で参照するエントリは除く
- catalog が持つバージョンを、マニフェストが直接書き写していない
- 複数のマニフェストが同じバージョンを catalog の外で繰り返していない
- バージョンが食い違う宣言も失敗として出す。どのバージョンへ揃えるかは人が選び、選んだバージョンを catalog に置いて全マニフェストから参照する
- 何も使っていない catalog エントリは報告しない。未使用の検出は knip が持つ

## テスト設定と実行経路の検査

`check` はワークスペース定義の有無にかかわらずルートの `package.json` を読み、定義があれば一致するワークスペースの `package.json` も読む。lint は Vite/Vitest 設定を静的に検査する。coverage の source universe を明示する判断は [EDR 0059](../../docs/engineering-decision-logs/0059-make-the-coverage-source-universe-explicit.md)、manifest の列挙方法は [EDR 0061](../../docs/engineering-decision-logs/0061-use-node-globs-for-workspace-manifests.md) が持つ。

- test command が `--config` / `-c` で別の設定を選んでいない。test 設定は自動発見される `vite.config` / `vitest.config` に置く
- test command が bare `--coverage` 以外の coverage CLI option で静的設定を上書きしていない。coverage の lint と実行時ゲートは同じ source universe と threshold を読む
- test config を持つ workspace が文字列の `scripts.test` を持ち、現在packageの通常test runを1回だけ静的に露出する。`spool -- vp test` を標準形とし、直接Vitestを使う場合は`vitest run`または`./node_modules/.bin/vitest run`とする。runner引数は任意のbare `--coverage` 1個以外を置かない。`--changed` / `--changed=...`、`pretest` / `posttest`、環境・cwd・workspace・package・binary解決を変えるwrapper、package-manager / Vite Plus exec、別root / project、watchを含む非run mode、任意pathの実行ファイル、parameter / command / pathname / brace expansion、`env -S`、未知のwrapper、shell mode、control operator、別名のscriptへの委譲を置かない
- root の `scripts.guard` が `throttle --timeout 1800 -- spool -- vp run guard:all` だけを実行し、引数や別commandを足さない
- root の `scripts.guard:all` が静的なcommandを `&&` だけでつなぎ、`vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2` をちょうど1回直接実行する。task名より後ろは各packageのtest scriptへ転送されるため、rootから渡すrunner引数はcoverageの有効化とworker上限だけに固定する
- canonical な `vite.config` / `vitest.config` が ESM の静的な object literal、または正規 module から import した `defineConfig({...})` として書かれている。CommonJS と動的な合成は source universe と threshold の証明を妨げる
- canonical config に top-level `root` が存在しない。config と source discovery は package root を基準にし、所有する production source は `test.coverage.include` で宣言する
- canonical config の `test.changed` と `test.coverage.changed` は literal `false` または空文字だけを許す。`true` と空でない ref は削除し、動的な値は実効値を証明できる静的宣言へ直す
- `run.tasks.test` が存在しない。test の入口は `package.json#scripts.test` に置き、config と coverage override の CLI 検査を必ず通す

## 必須ファイルの形の検査

`check` が、リポジトリの根と `package.json` を持つディレクトリを開き、そこに置かれていなければならないファイルが要求された形で存在しているかを読む。ファイルの中身は読まない。判断は [EDR 0045](../../docs/engineering-decision-logs/0045-require-the-form-of-the-files-a-repository-cannot-do-without.md) にある。

道具の設定が TypeScript の外に置かれていないことを見る。対象は knip・oxlint・eslint・vite で、それぞれの道具自身が読む綴りのうち、型検査が届かないものを名指しする。報告には移し先の綴りを載せる。oxlint と vite の移し先は `vite.config.ts` で、knip は `knip.ts`、eslint は `eslint.config.ts` になる。

AI 向けの指示が 1 か所にしかないことを見る。`AGENTS.md` が実体で、`CLAUDE.md` はそこを指すシンボリックリンクである。

- `AGENTS.md` を持つディレクトリに `CLAUDE.md` がある
- `CLAUDE.md` が実体ファイルではない
- `CLAUDE.md` が `AGENTS.md` 以外を指していない
- `CLAUDE.md` だけがあって `AGENTS.md` が無い状態になっていない

- IF: 道具の設定を TypeScript 以外の綴りで置きたくなった; THEN PROHIBIT: 置く
  - 型検査もフォーマッタも lint も届かない設定は、それが支配しているコードから静かにずれていく
- IF: 道具が TypeScript の設定を読めない; THEN MUST: その道具を使わない判断から始める
  - 綴りを増やす前に、ツールチェーンを一本化する規約（[AGENTS.md](../../AGENTS.md)）に戻る
- IF: 検査対象の綴りを増やす; THEN MUST: その道具自身が読む綴りの一覧を一次情報で確かめてから足す
  - 道具が読まない綴りを足すと、直しようのない報告が出る
- IF: `CLAUDE.md` に `AGENTS.md` と違うことを書きたくなった; THEN PROHIBIT: 書く
  - 読み手ごとに違う規範を配ると、どちらが正なのかを人間が毎回決めることになる

## preset の適用範囲の検査

`check` が、ルートのツールチェーン設定とワークスペースの一覧を突き合わせる。preset の `lint` 関数を呼んだ時点で全体に効くという前提が、実際に成り立っているかを見る。

`vite.config.ts` があるなら、`@mst/dont-review-it` の値 export `dontReviewItPreset` を静的 import し、root の `lint` からその `lint` 関数を object literal 1 つで直接呼ぶ。named alias と namespace は許す。type-only import、別 module、dynamic import、local relay、computed member、spread、重複は採用として扱わない。ツールチェーン設定が無いリポジトリでは導入を要求しない。

設定を読んで `off`、`allow`、数値 `0`、`LINT_SEVERITY.OFF` のような名前付き定数にされている preset のルールと、それらを先頭に置く配列を拾う。root の `rules` と `overrides` を静的に読めない設定と、disabled preset rule の severity、`files`、`excludeFiles` を静的に読めない設定も problem にする。EDR 0042 が記録する 1 rule と 3 workspace の完全一致だけを warning に留め、それ以外の disabled declaration は problem にする。preset の外のルールは見ない。

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
- `skills/CHANGELOG.md` があり、マニフェストの `version` を `## <version>` の見出しとして持つ
- 同梱する各 SKILL.md の `metadata.library_version` が、マニフェストの `version` と一致する

`private: true` のパッケージには、同じものが書かれていないことを要求する。出荷されない skill と、出荷されない前提の配線は、読む側に嘘を教える。

`version` を持たないマニフェストには、版に関する 2 点を要求しない。

changelog の中身は読まない。項目が実態と合っているかは機械が判定しないので、次の規範は人が守る。

- IF: SKILL.md の中身の構造を検査したくなった; THEN MUST: この検査に足さず、上流の `intent validate`（各パッケージの `check:skills`）に任せる
  - 不変条件の分担は [EDR 0030](../../docs/engineering-decision-logs/0030-ship-agent-skills-with-published-packages-and-gate-the-shipping-ourselves.md) が決めている
- IF: 公開パッケージの `version` を上げる; THEN
  - MUST: 同じ変更で `skills/CHANGELOG.md` にその版の見出しを書く
  - PROHIBIT: `metadata.library_version` を手で書き換える
    - マニフェストから一意に決まる値なので `check --write` が揃える
- IF: 既に書いた版の項目と実態が食い違った; THEN
  - IF: その版をまだ publish していない; THEN MUST: その項目を実態に合わせて書き直す
  - IF: その版を publish 済み; THEN
    - PROHIBIT: その項目を書き直す
    - MUST: 版を上げ、新しい項目に書く
      - 配った tarball の中身は変わらない。過去の項目を今の姿へ寄せると、版ごとの差分という changelog の役目が消える
- IF: 版を上げた変更で SKILL.md の差分も要求したくなった; THEN PROHIBIT: 足す
  - 書くことが無いのに本文をいじる操作が生まれる。線の引き方は [EDR 0044](../../docs/engineering-decision-logs/0044-ship-a-changelog-beside-the-skills-and-check-it-against-the-manifest.md) が決めている
