# 0031. リポジトリの CLI を citty の上に建てる

- ステータス: Accepted
- 日付: 2026-08-11

## 文脈

`@mst/dont-review-it` の CLI は `node:util` の `parseArgs` で書かれていた。usage 文字列は手書きで、コマンドの追加はディスパッチの if 文を増やす作業だった。CLI パッケージ向けの規律（[CLI の作り方](../../packages/dont-review-it/docs/cli.md)）を config として出すにあたり、規律が前提にするコマンドフレームワークを 1 つに決める必要があった。前提が無いと、help の契約やサブコマンド分割の規範が「使っているライブラリによる」で骨抜きになる。

## 決定

**リポジトリの CLI は [citty](https://github.com/unjs/citty) で書く。** 選定の理由は 3 つ。

- コマンド定義が `defineCommand` に渡す静的なオブジェクトになるため、lint ルールが AST から定義の形を検査できる。`no-citty-parent-run--move-run-into-a-subcommand` はこの性質に乗っている
- help の描画（description・`valueHint`・既定値の表示）がフレームワーク側にあり、usage 文字列の手書きが消える
- 依存が薄く、活発に保守されている（2026-08 時点で最終 push が当月、v0.2.2 が 2026-04 リリース）

`dont-review-it` の `check` CLI を citty へ移行し、最初の利用者にした。親コマンドは `subCommands` だけを持ち、`run` を持たない。サブコマンド無しの呼び出しは citty が `E_NO_COMMAND` で落とす。

## 影響

**exit code の分類が citty の流儀に寄った。** サブコマンド名の誤りや欠落は citty の `runMain` が usage を表示して 1 で終える。`check` 自身の誤用（未知のオプション、走査できないパス）は従来どおり 2 で終える。

**未知のオプションは自前で拒否する。** citty のパーサは宣言外のフラグを黙って通すため、`check` は宣言済みフラグ以外を検出して非ゼロで終える。黙って無視されるオプションは、help に現れない裏サーフェスと同じだからである。

**stdout / stderr の契約はテストで固定した。** 移行と同時に、CLI のテストを `standardIoTest` フィクスチャから導出し、両ストリームをスナップショットで固定する形にした。
