# 0023. AI 由来の不要コード検査を一つのコマンドから順番に実行する

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

機能を削除する変更で、AI が削除済み対象の不存在だけを固定するテストや検査を追加することがある。変更後のコードだけを見ると、その検査は通常の否定 assertion と区別できない。変更種別を人や AI に自己申告させても、申告が間違っていれば検査が空振りする。

同じ種類の問題は今後も増える。個別の問題ごとに package や CLI のサブコマンドを増やすと、利用者は追加された検査を知り、品質ゲートの呼び出しを更新し続けることになる。一方で、試行中の検査を直ちに `dont-review-it` へ入れると、安定した規範と観測中のヒューリスティックが同じ公開面とリリース周期を持つ。

削除後の不存在検査を直接検出する成熟した既存ツールは見つからなかった。差分構造の解析、変更前後のソース解析、両者の関連付けを組み合わせる必要がある。

## 決定

`@mst/stop-ai-slop` を独立 workspace package として作る。公開 CLI は `stop-ai-slop check` 一つだけにし、内部の順序付き registry に登録された検査機能をすべて実行する。今回の削除後チェック検出を最初の検査機能にする。

package の公開面は bin と `./package.json` に限定する。試行中に外部から使われない JavaScript API を作らず、`includeEntryExports` による未使用検出を維持する。

比較元と比較先は `--base` と `--head` で必ず明示する。merge-base、index、worktree を CLI が推測しない。実行場所ごとに意味が違う比較を一つの暗黙値へ畳まないためである。

変更 path とファイル分類は Git の NUL 区切り metadata を正とし、空白や制御文字を含む path を変形させない。`parse-git-diff` は patch の構造と追加行位置だけに使い、metadata とファイル数・変更種別が食い違えば利用エラーにする。削除行や追加行の断片は構文として不完全なので AST 解析しない。base と head の完全な Git blob を `oxc-parser` で解析し、変更前から消えた対象と変更後に増えた検査を小さな locator で比較する。

初期の locator はファイルパスと、モジュールパスと named value export 名の組だけにする。追加検査から同じ locator を完全に復元できる `existsSync(...).toBe(false)`、namespace の `not.toHaveProperty`、静的 property の `toBeUndefined` だけを報告する。import binding は assertion の lexical scope で解決する。同じ locator の検査が増えた場合は増加数を保持し、diff の追加行は増加した occurrence の位置決定に使う。import 変更で locator 自体が変わった検査も新規として扱う。自然言語、bare name、類似度、動的な値から意図を推測しない。

Git、revision、diff、source parse の失敗は終了コード 2 にする。読み取れなかった変更を問題なしへ変換しない。問題の抑制、severity、allowlist は設けない。誤検知する形は検出対象から外す。

pull request では base branch tip と head の merge-base を base revision とし、head SHA までを非ブロッキングで検査する。base branch が先に進んだ場合も pull request の変更だけを比較する。試行期間は finding の実例を観測し、通常の品質検査とは分けて表示する。

## 帰結

- 新しい検査機能は registry へ追加するだけで `stop-ai-slop check` から実行される
- 検査機能の定義順が実行順と出力の第一順序になる
- 削除だけ、検査追加だけ、rename、同名の別モジュール、既存検査の整形は報告されない
- 初期版は取りこぼしを許容する。静的な locator を復元できない構文は通る
- `dont-review-it` は `stop-ai-slop` に依存しない。検出境界と運用が安定してから統合を判断する
- pull request の finding は観測できるが、それだけでは merge を止めない

## 検討して採らなかった案

**変更種別を removal-only として申告させる。** 申告と実際の差分が食い違う問題を解決しない。検査したい事実は base と head に既に含まれている。

**追加行だけを正規表現で探す。** diff の hunk は構文として不完全であり、import が指す対象や assertion の receiver を解決できない。同名文字列を通常コードや説明文から拾う。

**最初から `dont-review-it` のサブコマンドにする。** 観測中の検出境界を安定した規範と同じ package lifecycle に置くことになる。独立 package で実例を集めても、利用者が実行する公開コマンドは一つに保てる。

**検査機能ごとにサブコマンドを作る。** 機能を追加するたびに CI と利用者のコマンド更新が必要になる。実行漏れを CLI の形で作ることになる。
