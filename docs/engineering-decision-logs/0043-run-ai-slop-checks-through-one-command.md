# 0043. AI 由来の不要コード検査を一つのコマンドから順番に実行する

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

機能を削除する変更で、AI が削除済み対象の不存在だけを固定するテストや検査を追加することがある。変更後のコードだけを見ると、その検査は通常の否定 assertion と区別できない。変更種別を人や AI に自己申告させても、申告が間違っていれば検査が空振りする。

同じ種類の問題は今後も増える。個別の問題ごとに package や CLI のサブコマンドを増やすと、利用者は追加された検査を知り、品質ゲートの呼び出しを更新し続けることになる。一方で、試行中の検査を直ちに `dont-review-it` へ入れると、安定した規範と観測中のヒューリスティックが同じ公開面とリリース周期を持つ。

削除後の不存在検査を直接検出する成熟した既存ツールは見つからなかった。差分構造の解析、変更前後のソース解析、両者の関連付けを組み合わせる必要がある。

## 決定

`@mst/stop-ai-slop` を独立 workspace package として作る。公開 CLI は `stop-ai-slop check` 一つだけにし、内部の順序付き registry に登録された検査機能をすべて実行する。今回の削除後チェック検出を最初の検査機能にする。

package の公開面は bin と `./package.json` に限定する。試行中に外部から使われない JavaScript API を作らず、`includeEntryExports` による未使用検出を維持する。

比較する 2 点は CLI が決める。意味は「main に入ろうとしている変更」の 1 つに固定し、merge の最中は `MERGE_HEAD` とそれが分かれた地点、そうでなければ `origin/main` から分かれた地点と `HEAD` を取る。`--base` と `--head` は明示の上書きとして残し、片方だけ渡した場合は利用エラーにする。

呼び出し側に 2 点を計算させない理由は、この検査を `vp run guard` の並びに置くからである。`package.json` の scripts が持てるのはコマンドの名前と 1 本の呼び出しだけで、分岐や対象探索をそこに書けない（[強制の機構](../guidelines/enforcement.md)）。決め方を持つのは、型と自動テストを持つリポジトリ内のコードになる。

git を起動するときは `GIT_` で始まる環境変数を落とす。git は hook に `GIT_DIR` を渡し、子プロセスはそれを継承する。`--repository-root` で名指ししたリポジトリ以外を見ないためである。

変更 path とファイル分類は Git の NUL 区切り metadata を正とし、空白や制御文字を含む path を変形させない。`parse-git-diff` は patch の構造と追加行位置だけに使い、metadata とファイル数・変更種別が食い違えば利用エラーにする。削除行や追加行の断片は構文として不完全なので AST 解析しない。base と head の完全な Git blob を `oxc-parser` で解析し、変更前から消えた対象と変更後に増えた検査を小さな locator で比較する。

初期の locator はファイルパスと、モジュールパスと named value export 名の組だけにする。追加検査から同じ locator を完全に復元できる `existsSync(...).toBe(false)`、namespace の `not.toHaveProperty`、静的 property の `toBeUndefined` だけを報告する。import binding は assertion の lexical scope で解決する。同じ locator の検査が増えた場合は増加数を保持し、diff の追加行は増加した occurrence の位置決定に使う。import 変更で locator 自体が変わった検査も新規として扱う。自然言語、bare name、類似度、動的な値から意図を推測しない。

Git、revision、diff、source parse の失敗は終了コード 2 にする。読み取れなかった変更を問題なしへ変換しない。問題の抑制、severity、allowlist は設けない。誤検知する形は検出対象から外す。

pull request の CI は、比較する 2 つの側を GitHub API から読む。`actions/checkout` は pull request で `refs/pull/N/merge` を depth 1 で 1 本だけ取り、`origin/main` も親コミットも置かない。shallow graft で親が切られるので `HEAD^1` も解決できない。取得量が履歴の長さに比例する `fetch-depth: 0` は、リポジトリが育つほど CI が遅くなるので採らない。API から取るのは compare の結果と、変更があったソースの base と head の中身だけで、量は差分の大きさに比例する。base と head の SHA は checkout 済みの merge コミットの parent 行から読む。オブジェクトは無くてもコミット自身は手元にある。

読む側を切り替えるのは CLI の中で、`origin/main` も merge の親も無いときだけである。CI は `contents: read` に限定した `github.token` を guard の `GITHUB_TOKEN` へ渡す。権限の宣言だけでは token は run step の環境変数にならず、API fallback を呼び出せないためである。

実行の経路は `vp run guard` の 1 本にする。CI に観測用の実行ブロックを置かない。ゲートを guard の外に置くと、main に変更が入る 2 つの経路が別々の検査集合を通ることになる。観測用に置いていたブロックは、複数行の実行・`continue-on-error`・イベントによる絞り込みを持っていて、[0025](0025-check-workflow-definitions-with-our-own-policy-layer.md) が入れたワークフロー定義の検査にも 3 点で反していた。

## 帰結

- 新しい検査機能は registry へ追加するだけで `stop-ai-slop check` から実行される
- 検査機能の定義順が実行順と出力の第一順序になる
- 削除だけ、検査追加だけ、rename、同名の別モジュール、既存検査の整形は報告されない
- 初期版は取りこぼしを許容する。静的な locator を復元できない構文は通る
- `dont-review-it` は `stop-ai-slop` に依存しない。検出境界と運用が安定してから統合を判断する
- 報告が出れば guard が落ちる。手元の main へ merge する経路では `pre-merge-commit` がこれを走らせる
- `origin/main` も merge の親も無く、GitHub の資格情報も無い checkout では終了コード 2 で落ちる
- このパッケージが GitHub に問い合わせる経路を持った。他の検査は持っていない

## 検討して採らなかった案

**変更種別を removal-only として申告させる。** 申告と実際の差分が食い違う問題を解決しない。検査したい事実は base と head に既に含まれている。

**追加行だけを正規表現で探す。** diff の hunk は構文として不完全であり、import が指す対象や assertion の receiver を解決できない。同名文字列を通常コードや説明文から拾う。

**最初から `dont-review-it` のサブコマンドにする。** 観測中の検出境界を安定した規範と同じ package lifecycle に置くことになる。独立 package で実例を集めても、利用者が実行する公開コマンドは一つに保てる。

**検査機能ごとにサブコマンドを作る。** 機能を追加するたびに CI と利用者のコマンド更新が必要になる。実行漏れを CLI の形で作ることになる。
