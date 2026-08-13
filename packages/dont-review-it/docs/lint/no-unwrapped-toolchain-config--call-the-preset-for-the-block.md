# no-unwrapped-toolchain-config--call-the-preset-for-the-block

## 何を検出するか

Vite+ の `defineConfig` に渡すオブジェクトが持つ `lint` と `fmt` のうち、値がそのブロックに対応する preset 関数の呼び出し（`dontReviewItPreset.lint(...)` と `dontReviewItPreset.fmt(...)`）になっていないものを報告する。

`defineConfig` の同定は import で行う。`vite-plus` から入ってきた名前だけを見るため、名前付き import（`import { defineConfig } from "vite-plus"`）でも名前空間 import（`import * as vitePlus from "vite-plus"` に対する `vitePlus.defineConfig`）でも同じく捕まえる。ローカルで別名を付けても、束縛をたどるので変わらない。`vite-plus` 以外から来た `defineConfig` は別の関数であり、対象にしない。

preset の同定も同じで、`@mst/dont-review-it` から入ってきた `dontReviewItPreset` だけを認める。名前空間経由でも別名付きでも認める一方、綴りが同じでも別のモジュールから来た値、`Object.freeze(...)` のような別の呼び出し、括り出した変数を名前で渡す形（`defineConfig({ lint })`）はいずれも通らない。preset を通った値かどうかは、その場に書かれた呼び出しからしか判定できないためである。

呼び出しているメンバがブロックの名前と一致していることまで見る。`fmt` に `dontReviewItPreset.lint(...)` を置いた形は、preset を通ってはいるが別の種類の設定を返すので報告する。計算されたメンバ（`dontReviewItPreset["lint"]`）は静的に確定しないものとして扱い、認めない。

キーは識別子でも文字列リテラル（`"lint"`）でも同じキーとして扱う。計算されたキーは対象外にする。

`lint` も `fmt` も書かれていない設定は報告しない。ワークスペース側の `vite.config.ts` は `pack` だけを書くのが普通で、そこに空の `lint` を足させる理由はない。したがってこのルールが守るのは「書くなら必ず preset を通す」であって、「必ず書く」ではない。

## なぜそれが要るか

守っている不変条件は 2 つある。「git が無視しろと言っているものを、linter と formatter が読みに行かない」ことと、「このリポジトリのルール集合と整形の選択が、呼び出し側の書き写しなしに届く」ことである。

oxlint はリポジトリの `.gitignore` と `$GIT_DIR/info/exclude` を歩く時点で尊重するが、`core.excludesFile` が指すマシン全体の ignore だけは見ない。したがってエージェントの作業ディレクトリや個人用のスクラッチ置き場のように、リポジトリに書かず手元のグローバル設定で無視しているものは、そのまま lint 対象に入り込む。formatter も同じで、無視しているはずのディレクトリの中身を書き換える。

その差を埋めるのが `ignorePatterns` だが、oxlint は `extends` で名指しした設定が持つ `ignorePatterns` を捨て、`extends` を書いた側の設定に書かれたものだけを使う。`rules` や `overrides` や `plugins` は継承されるのに、`ignorePatterns` だけが継承されない。つまり preset をいくら整えても、`extends` の口からこのパターン列を配ることはできない。パターン列は、必ず `defineConfig` に直接渡すオブジェクト自身が持っていなければならない。

oxfmt にはそもそも `extends` が無い。整形の選択も同じく、`defineConfig` に直接渡すオブジェクト自身が持つしかない。

`dontReviewItPreset` の 2 つの関数は、この「直接渡すオブジェクトでなければ効かないもの」をまとめて載せて返す。git の ignore 設定（グローバル → `$GIT_DIR/info/exclude` → リポジトリの `.gitignore` の順、gitignore の last-match-wins に合わせてある）から作ったパターン列、`lint` にはルール集合、`fmt` には整形の選択が入る。呼び出し側が書くべきことは何もなく、忘れたときだけこのルールが報告する。

埋めたい穴はグローバルの 1 経路だけだが、読むのは 3 経路すべてである。パターンの優先順位は経路をまたいで決まるため、1 か所に並べないと、グローバル側の指定をリポジトリ側の `!` が打ち消す関係を表現できない。

preset を忘れても lint は緑のまま通る。無視されるはずのファイルが増え、ルールが 1 本も効かなくなるだけで、失敗として現れない。人間が気づく契機がないため、機械が見張る。

## どう直すか

該当のブロックを、そのブロックの名前を持つ preset 関数で包む。追加のルールや設定は引数にそのまま渡せる。

```ts
import * as dontReviewIt from "@mst/dont-review-it";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: dontReviewIt.dontReviewItPreset.fmt(),
  lint: dontReviewIt.dontReviewItPreset.lint({
    rules: {},
  }),
});
```

`ignorePatterns` を自分でも書きたい場合はそのまま渡せばよい。preset は git 由来のパターンを前に置くだけなので、後ろに残る手書きのパターンが優先される。`extends` に別の preset を足したい場合も同じで、渡した分は自前の preset の後ろに並ぶ。

## 違反にならないもの

- `lint` も `fmt` も持たない設定
- `defineConfig` に渡らないオブジェクト。`lint` というキーを持つだけの値は設定ではない
- `vite-plus` 以外から import した `defineConfig` の呼び出し
- `dontReviewItPreset` を別名で import した呼び出し。束縛が同じであれば綴りは問わない

## 禁じる回避策

- preset の代わりに `ignorePatterns` やルール集合を手で書き写す。書いた時点の写しでしかなく、preset が変わった瞬間にずれる。ずれても lint は緑のまま通る
- `defineConfig` を経由しない別の口から設定を組み立てて、このルールの視界から外す
- 抑制ディレクティブ

## オプション

取らない。
