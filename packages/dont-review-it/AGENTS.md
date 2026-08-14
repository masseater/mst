---
description: Machine-enforced answers to the writing questions that would otherwise be raised in review.
---

# @mst/dont-review-it

## このパッケージが守るもの

コードの書き方について、レビューで人間が問い直さずに済む状態。

同じ問いがレビューのたびに立つなら、その問いには答えが 1 つあるはずで、答えがあるなら人間が毎回出す必要はない。ここに入るのは、答えが一意に決まる問いだけである。答えが状況によって変わるものは、機械で止めるとかえって判断を奪う。

## ルールの境界

- IF: ある書き方を禁じたい; THEN
  - MUST: 直し方が一意に決まることを先に確かめる
  - PROHIBIT: 直し方が複数ある問いをルールにする
    - 報告を受けた側がどれを選ぶかで迷い、迷いをレビューに戻すことになる
- IF: 検出できない回避策がある; THEN MUST: 文書の禁止事項として名指しする
  - 検出できないことは許していることを意味しない。この差を文書で埋める

同じ不変条件を守る公式のルールを先に探すこと、どの順に検討するか、自前で書いてよい条件と書いたあとの後始末は [AGENTS.md](../../AGENTS.md) が持つ。

## 文書

ルールごとに `docs/lint/<ルール名>.md` を持つ。何を検出するか、なぜそれが要るか、どう直すか、どんな回避策を禁じるかを書く。報告メッセージには直し方だけを載せ、理由は文書側が持つ。

説明に載せる例をどこから作るかは [文書](../../docs/guidelines/documents.md) が持つ。良い例と悪い例を対で置かないことは [規範の書き方](../../docs/normative-notation.md) が持つ。

## 公開する config

公開する config は `dontReviewItPreset` の 1 つだけである。`fmt` と `lint` の 2 つの関数を持ち、ルートの `vite.config.ts` はそれぞれのブロックで対応する関数を呼ぶ。呼び出し側が足したいものは引数に渡し、preset が返した値へ後ろから重なる。呼び忘れは [no-unwrapped-toolchain-config--call-the-preset-for-the-block](docs/lint/no-unwrapped-toolchain-config--call-the-preset-for-the-block.md) が報告する。

`lint` が配るルール集合は 1 枚だけである。対象種別による出し分けはしない。ルートの `lint` が呼んだ時点でリポジトリ全体に効き、採用の判断は残らない。CLI に固有の規律もこの中にあり、対象を絞るのはルールの側である。判断は [EDR 0042](../../docs/engineering-decision-logs/0042-apply-one-preset-at-the-root-and-report-the-exception-the-toolchain-forces.md) にある。

仕様担保テストの置き場所だけは、この 1 枚の中で `overrides` として範囲を絞る。`specs/` の下はテスト規律の束の射程外で、名前の綴りを `.spec.ts` に切り替え、ソース隣接の要求と `describe` の入れ子の上限をそこに与える。射程の分担は [EDR 0039](../../docs/engineering-decision-logs/0039-let-the-specifications-bundle-guard-the-specs-directory-alone.md) が、設定の所在は [EDR 0057](../../docs/engineering-decision-logs/0057-read-the-spelling-the-repository-mandates-and-move-the-spec-lint-settings-into-the-preset.md) が決めている。

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
- IF: 見つけた事象の直し方が一意に決まらない; THEN
  - MUST: `warning:` を先頭に付けて報告し、終了コードに数えない
    - 直し方が複数ある問いで落とすと、どれを選ぶかの迷いがレビューに戻る。これはルールの境界と同じ判断で、警告は検出できることを伝えるためだけに出す

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

`check` が `pnpm-workspace.yaml` と、そこに宣言されたワークスペースの `package.json` も読む。ワークスペース定義が無いリポジトリでは何も検査しない。守っているのは「catalog は複数のワークスペースが共有するバージョンだけを持つ」という規範で、判断は [EDR 0028](../../docs/engineering-decision-logs/0028-keep-the-catalog-for-shared-versions-only.md) にある。

- 読めないワークスペース定義が残っていない
- 1 つのマニフェストしか使わない catalog エントリが残っていない。overrides が `catalog:` で参照するエントリは除く
- catalog が持つバージョンを、マニフェストが直接書き写していない
- 複数のマニフェストが同じバージョンを catalog の外で繰り返していない
- バージョンが食い違う宣言は警告として出す。どちらへ揃えるかは判断なので落とさない
- 何も使っていない catalog エントリは報告しない。未使用の検出は knip が持つ

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

## 計測の配線の検査

`check` が、ワークスペースのツールチェーン設定を開き、時間を使うブロックが計測を宣言しているかを読む。宣言が無いワークスペースを問題として報告する。

守っているのは「計測は時間を使っている当人に置く」という規範で、その裏返しとして、当人が計測を宣言し忘れた状態を検出する。包む方式を採らないと決めた以上、宣言の抜けは誰も包み忘れを教えてくれない。判断は [EDR 0064](../../docs/engineering-decision-logs/0064-carry-one-trace-through-the-gate-and-let-the-agent-query-it.md) にある。

見るのは宣言の有無だけで、宣言された値が正しく効いているかは見ない。

- IF: 計測を宣言していないワークスペースを見つけた; THEN
  - MUST: 落とす
    - 直し方は宣言を足すことに 1 つ決まる
  - PROHIBIT: 警告に留める
    - 計測されていないワークスペースは、計測結果の上では速いワークスペースと同じ見た目になる。警告のまま残ると、その見分けが付かない状態が続く
- IF: 宣言された値が実際に送信まで届いているかを検査したくなった; THEN PROHIBIT: この検査に足す
  - 手元の入力だけで結果が決まらなくなり、受け皿の起動状態で判定が変わる

## preset の適用範囲の検査

`check` が、ルートのツールチェーン設定とワークスペースの一覧を突き合わせる。preset を `extends` した時点で全体に効くという前提が、実際に成り立っているかを見る。

設定を読んで `off` にされている preset のルールを拾い、その `files` が届くワークスペースを名指しして警告する。パスを絞らずに止めたルールは、すべてのワークスペースに届かないものとして数える。preset の外のルールは見ない。ツールチェーン設定が無いリポジトリでは何も検査しない。

報告を警告に留めるのは、止め方を解く手段が 1 つに決まらないためである。override を消して報告を直す道と、依存の向きなどで届かないことを記録して残す道があり、どちらを選ぶかは判断になる。

- IF: preset のルールを `overrides` で止める; THEN
  - MUST: 止めた理由を EDR に残す
    - 警告は消えない。理由が無い `off` は、適用範囲への載せ忘れと見分けが付かない
- IF: 警告が指すワークスペースを preset の下に戻せた; THEN MUST: `off` を消す
  - 残った `off` は、いつか誰かが「元からそうだった」として読む

## 出荷できるパッケージの検査

`check` が、ワークスペースのマニフェストを読み、npm へ公開できるパッケージが公開された状態で解決できるかを見る。見るのは宣言だけで、成果物が実在するかは見ない。判断は [EDR 0066](../../docs/engineering-decision-logs/0066-replace-the-published-entries-and-bundle-the-internal-contract.md) にある。

- 公開できるパッケージが、`private: true` のワークスペースを `dependencies` / `peerDependencies` / `optionalDependencies` で参照していない
- 公開後に実行時が解決する入口が、型注釈を持つソースを指していない
- 公開後の入口が指す場所を、`files` の許可リストが載せている

入口は `publishConfig` が置き換えた後の姿で読む。型を渡すだけの `types` 条件は見ない。宣言ファイルでないソースをそこに置くのは正当である。

- IF: 公開できるパッケージが `private: true` のワークスペースを必要とする; THEN
  - MUST: `devDependencies` で参照し、成果物へ畳む
  - PROHIBIT: `dependencies` で参照する
    - レジストリはその名前を解決できず、install した側がそこで止まる
- IF: 手元の参照をソースのままにしたい; THEN
  - MUST: `publishConfig` に公開後の入口を書く
  - PROHIBIT: 公開される入口をソースのままにする
    - ワークスペースのリンクは実体のパスへ解決されるため、手元では動いて公開後だけ動かない
- IF: 成果物が実在するかを検査したくなった; THEN PROHIBIT: この検査に足す
  - ビルドの前後で同じコミットへの判定が変わる

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
