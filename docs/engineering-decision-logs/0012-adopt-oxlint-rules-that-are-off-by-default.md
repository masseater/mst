# 0011. 既定で無効な oxlint のルールを入れ、閾値は実測の縁に置く

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

`@mst/dont-review-it` の base preset は、これまで `dont-review-it/*` の自前ルールだけを宣言していた。oxlint 側は既定で有効なカテゴリしか効いておらず、oxlint に実装があるのに使っていないルールが残っていた。

自前ルールには [0004](0004-shape-the-lint-rule-foundation-around-tooling-limits.md) が書いたとおりの持ち出しがある。型の組み直し、テスト基盤、文書の置き場所。既製で足りるものを自前で書き直す理由はない。

閾値を持つルールは、値をどこに置くかが別の問題になる。[0007](0007-name-the-scope-and-the-initial-budget.md) は `forbid-oversized-file` の予算について 2 つを決めた。ルールの既定と同じ値でも mst の設定側に書くこと、そして余裕を作るために予算を上げないこと。今回の 3 本も同じ扱いにする。

## 決定

**閾値を持たない 7 本をそのまま error にする。** `no-empty` / `no-console` / `no-empty-function` / `no-duplicate-imports` / `typescript/no-explicit-any` / `typescript/ban-ts-comment` / `typescript/no-unnecessary-type-conversion`。

入れた時点の違反は `no-duplicate-imports` の 30 件だけで、残る 6 本は 0 件だった。30 件はすべて「同じモジュールから値の import と `import type` を別々に書いている」形で、値の import に `type` 修飾子付きの specifier を足して 1 本にまとめた。`import type` の行が残るのは、そのモジュールから値を取っていない場合だけになる。

**閾値を持つ 3 本は、実測した最大の縁に予算を置く。** 既定と違う値になったものも、既定と同じ値になったものも、設定側に明示的に書く。

| ルール                   | oxlint の既定 | mst の値            | 実測の最大            |
| ------------------------ | ------------- | ------------------- | --------------------- |
| `max-depth`              | 4             | 4                   | 4（2 箇所）           |
| `max-params`             | 3             | 4                   | 4（7 箇所）           |
| `max-lines-per-function` | 50            | 200、テストのみ 320 | 実装 188 / テスト 313 |

`max-depth` は実測の最大がちょうど 4 で、既定と同値になった。同値でも設定側に書くのは、この 4 が oxlint の都合ではなく mst の予算であることを示すためである。

`max-params` は既定より 1 大きい。4 引数の関数が 7 箇所あり、いずれも型の異なる位置引数で、束ねたときに付く名前が無い。予算を実測の縁に置く方針を採ると 4 になる。

`max-lines-per-function` が数えるのはコード行である。`skipBlankLines` と `skipComments` をどちらも true にした。既定はどちらも false で物理行を数える。[0007](0007-name-the-scope-and-the-initial-budget.md) がファイルの予算で物理行を採らなかったのと同じ理由で、予算に近づいた関数で最初に起きることを「説明を削る」にしたくない。

**`max-lines-per-function` だけ、テストに別の予算を置く。** `overrides` で `**/*.test.ts` / `**/*.test.tsx` を 320 にする。[0007](0007-name-the-scope-and-the-initial-budget.md) はファイルの予算で種別を分けなかったが、それは実装 385 行・テスト 382 行で差が数字に出ていなかったためである。関数では実装 188 行・テスト 313 行と差が出ている。

## 影響

3 つの予算はどれも実測の最大の 1 つ上にある。次にブロックを 1 段深くする変更、引数を 1 つ足す変更、関数を伸ばす変更が最初に当たる。当たったときの行き先は分割であって、予算の引き上げではない。

型 import の綴りが変わった。同じモジュールから値と型を取るときは値の import に `type` 修飾子を付けて 1 本にする。これまでの「値の import 群、空行、`import type` 群」という並びは、値を取っていないモジュールについてだけ残る。

テストの予算は `.test.ts` / `.test.tsx` の綴りだけを見る。mst の規約がテストを対象と同階層の `.test.ts` に固定しているので、この 2 つで漏れない。[0007](0007-name-the-scope-and-the-initial-budget.md) が書いたとおり `.spec.` は mst に存在しないので入れていない。

`max-lines-per-function` の `IIFEs` は既定の false のままで、即時実行関数は行数に数えない。

## 検討して採らなかった案

**`max-params` を既定の 3 のままにし、7 箇所の署名を作り替える。** 4 引数を 1 つのオブジェクトに束ねると、束ねたものに付ける名前が「options」以上のものにならない。引数の意味が名前で説明されるようになるわけではなく、呼び出し側の記述量だけが増える。予算を実測の縁に置く方針とも合わない。

**`max-lines-per-function` をテストにも 200 で効かせ、テーブルを分割する。** 200 行を超えるテストの本体は `RuleTester` に渡す `valid` / `invalid` の配列で、長さはシナリオの数であって制御構造の複雑さではない。分割してもシナリオは減らず、`it` の数が増えるだけになる。

**`max-lines-per-function` を単一の 320 にする。** 実装側の最大が 188 なので 130 行以上の余裕ができ、実装に対して予算が当たらなくなる。[0007](0007-name-the-scope-and-the-initial-budget.md) の「予算は当たって初めて仕事をする」に反する。
