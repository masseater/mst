# CLI の作り方

bin を公開するパッケージが守る規範。機械で止められるものは CLI 向け config（`oxlintCli`）のルールが止める。ここに並ぶのは、lint では検出できないが同じ強さで守るものである。検出されないことは許されていることを意味しない。

## 採用

- IF: パッケージが実行可能エントリ（`bin`）を公開する; THEN
  - MUST: lint 設定の extends を `oxlint` ではなく `oxlintCli` にする
  - PROHIBIT: `oxlintCli` から一部のルールだけを外して使う
    - `oxlintCli` は全部入り config の上位集合であり、採用は「CLI パッケージかどうか」の 1 回の判断で終わる
- IF: パッケージが bin を公開しない; THEN MUST: `oxlint` のままにする

## コマンドの骨格

- IF: リポジトリの CLI を書く; THEN
  - MUST: citty をコマンドフレームワークにする（判断は [EDR 0031](../../../docs/engineering-decision-logs/0031-build-repository-clis-on-citty.md)）
  - MUST: 実行ファイルを所有パッケージの `bin` フィールドで宣言する
  - MUST: ルートの `package.json` には、パッケージの bin を呼ぶだけの薄いスクリプトを置く
- IF: CLI のエントリを増やしたくなった; THEN PROHIBIT: 既存の正規エントリへ委譲するだけの別名を作る
  - 呼び出し方が 2 つあると、ドキュメント・シェル履歴・CI 定義に別々の綴りが残り続ける
- IF: CLI サーフェスがテストからしか呼ばれない; THEN PROHIBIT: そのサーフェスを追加する

## 入力の設計

- IF: コマンドやサブコマンドを設計する; THEN
  - MUST: 目的を 1 つに絞り、その目的や実行時文脈から導出できない入力だけを晒す
- IF: 値がツールの目的から一意に決まる; THEN PROHIBIT: その値を呼び出し側のオプションにする
- IF: 呼び出し側ごとに本当に異なる解決戦略が要る; THEN
  - MUST: 戦略ごとの目的別サブコマンドに分ける
  - PROHIBIT: mode フラグで 1 つのコマンドの挙動を切り替える
- IF: 値が実行時文脈（CI かどうか、環境変数）から来る; THEN
  - MUST: CLI が所有する環境境界から読む
  - PROHIBIT: 同じ値を呼び出し側オプションとして重複させる
- IF: secret が要る; THEN
  - MUST: secret store への参照やパスとして受け取る
  - PROHIBIT: secret の素材そのものを通常のオプションで受け取る

## help の契約

- IF: コマンドやサブコマンドに説明を書く; THEN
  - MUST: 目的を述べる 1 文に収める
  - PROHIBIT: 例・操作手順・環境の説明を description に置く
- IF: 値を取るオプションを宣言する; THEN MUST: 値の形（`valueHint`）と実効既定値を help に出す
- IF: boolean のオプションを宣言する; THEN PROHIBIT: 値のプレースホルダを表示する
- IF: 引数や説明を変更した; THEN MUST: 描画された help と、help の正常終了を確認する

`check` サブコマンドの宣言が実例になる（[`src/check-command.ts`](../src/check-command.ts)）。

## 出力の契約

- IF: 既定の stdout がプログラム（AI を含む）に消費される; THEN PROHIBIT: 結果に進捗・デバッグ・中間状態を混ぜる
- IF: CLI が子プロセスをラップして CI で走る; THEN MUST: 子の stdout と stderr を完全に呼び出し側のログへ出す
- IF: ローカルと CI で挙動を変えたい; THEN
  - MUST: 実行時文脈から導出する
  - PROHIBIT: 呼び出し側が保守するモードフラグや、複製したスクリプトで分岐する
- IF: stdout / stderr の内容をテストする; THEN MUST: `@mst/dont-review-it/vitest` の `standardIoTest` からテストを導出し、両ストリームをスナップショットで固定する
  - 機械で強制される側は [no-handmade-standard-io-double](lint/no-handmade-standard-io-double--use-standard-io-test.md) と [require-standard-io-snapshot](lint/require-standard-io-snapshot--pin-both-streams.md) が持つ
- IF: 検査を走らせるコマンドが、どの観点をどれだけ開いたかを残す; THEN
  - MUST: 走査証跡を stderr に書く
  - PROHIBIT: stdout に混ぜる
    - 走査の事実は結果ではない。判断は [EDR 0041](../../../docs/engineering-decision-logs/0041-write-the-scan-trace-to-stderr-and-read-the-reader-from-the-runtime.md) にある
  - MUST: 対象を開かなかった観点を、開いて何も見つからなかった観点と別の形で書く
  - PROHIBIT: 対象がゼロだったことを理由に終了コードを変える
- IF: 読み手が人間か AI かで出力の形を変える; THEN
  - MUST: `std-env` の `isAgent` で実行時文脈から判別する
  - PROHIBIT: 呼び出し側が渡すフラグで切り替える
  - PROHIBIT: 判別に使う環境変数の一覧を自前で持つ

## パッケージ境界

- IF: パッケージの目的がライブラリの提供である; THEN
  - PROHIBIT: `bin` フィールドを生やす
  - MUST: 実行可能エントリが要るなら、CLI を目的とするパッケージに置く
    - ライブラリに bin が生えると、誰も保守を宣言していない第 2 の実行経路に呼び出し側が依存し始める
