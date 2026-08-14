# @mst/verified-specifications

生成物。`vp run guard:fix` が `specs/` の仕様担保テストから再生成する。手で編集しない。

## 検査の入口

[`specs/check-entry.spec.ts`](specs/check-entry.spec.ts)

- check 以外の命令に使い方を返して失敗する
- 知らない引数を誤用として失敗させる
- 問題が無ければ何も出力せず成功で終わる
- 問題を 1 件 1 行で、ファイルと行の位置から書き始める

## 仕様担保テストの構造

[`specs/claim-structure.spec.ts`](specs/claim-structure.spec.ts)

- 計算された名前を持つ主張を報告する
- test 関数で書かれた主張を報告する
- each や skip で絞られた宣言を報告する
- 主張を 1 つも持たない describe を報告する
- 最上位の describe を持たないファイルを報告する
- 構文として読めないファイルを報告する
- 構造に問題がある間は一覧を書き換えない

## 仕様一覧の生成

[`specs/specification-listing.spec.ts`](specs/specification-listing.spec.ts)

- 一覧の題をパッケージの名前にする
- describe の名前を見出しに、it の名前を箇条書きにする
- 主題の下に、その主張を検証している spec ファイルへのリンクを挿す
- 同じ主題を宣言した複数のファイルを 1 つの見出しに畳み、全ファイルへリンクする
- 主題をファイル名の順に並べる
- 一覧の先頭に、生成物であり手で編集しないことを書く

## 仕様一覧の鮮度

[`specs/specification-listing.spec.ts`](specs/specification-listing.spec.ts)

- 仕様担保テストの主張と食い違う一覧を報告して失敗する
- 書き込みの様態では一覧を主張どおりに書き直す
- 主張と一致する一覧を黙って通す
- 仕様担保テストが消えたのに残った一覧を報告する
- 書き込みの様態では、残った一覧を削除する
- 仕様担保テストの無いワークスペースに一覧を要求しない

## 検査対象を絞る tsconfig の検出

[`specs/tsconfig-scope-check.spec.ts`](specs/tsconfig-scope-check.spec.ts)

- include で検査対象を絞った tsconfig を報告する
- files や exclude による絞り込みも同じように報告する
- ワークスペースに tsconfig が無ければ、リポジトリの tsconfig を見る
- 仕様担保テストの無いワークスペースの tsconfig は見ない

## ワークスペースの走査

[`specs/workspace-scanning.spec.ts`](specs/workspace-scanning.spec.ts)

- ワークスペース定義に載る場所だけを走査する
- 名前の無い package.json を報告する
- ワークスペース定義が無ければ、リポジトリ自身を 1 つのワークスペースとして扱う
- specs の外に置かれた .spec.ts を主張として数えない
