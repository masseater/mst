# 0012. 既定で無効な oxlint のルールを入れ、閾値と重大度を mst の判断で置く

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

`@mst/dont-review-it` の base preset は、これまで `dont-review-it/*` の自前ルールだけを宣言していた。oxlint 側は既定で有効なカテゴリしか効いておらず、oxlint に実装があるのに使っていないルールが残っていた。

自前ルールには [0004](0004-shape-the-lint-rule-foundation-around-tooling-limits.md) が書いたとおりの持ち出しがある。型の組み直し、テスト基盤、文書の置き場所。既製で足りるものを自前で書き直す理由はない。

閾値を持つルールは、値をどこに置くかが別の問題になる。[0007](0007-name-the-scope-and-the-initial-budget.md) は `forbid-oversized-file` の予算について 2 つを決めた。ルールの既定と同じ値でも mst の設定側に書くこと、そして余裕を作るために予算を上げないこと。今回の 3 本も同じ扱いにする。

重大度も同じく、宣言しなければ oxlint の既定が決める。`AGENTS.md` は lint の重大度を「warn を人間に確認せず無視してよいもの、error を基本的にすべて解消するもの」と定めている。設定に重大度を書かないということは、oxlint の既定に「どれを無視してよいか」を決めさせているということである。

## 決定

**閾値を持たない 7 本をそのまま error にする。** `no-empty` / `no-console` / `no-empty-function` / `no-duplicate-imports` / `typescript/no-explicit-any` / `typescript/ban-ts-comment` / `typescript/no-unnecessary-type-conversion`。

入れた時点の違反は `no-duplicate-imports` の 30 件だけで、残る 6 本は 0 件だった。30 件はすべて「同じモジュールから値の import と `import type` を別々に書いている」形で、値の import に `type` 修飾子付きの specifier を足して 1 本にまとめた。`import type` の行が残るのは、そのモジュールから値を取っていない場合だけになる。

**閾値を持つ 3 本は、設定側に明示的に書く。** 既定と違う値になったものも、既定と同じ値になったものも書く。

| ルール | oxlint の既定 | mst の値 | 決め方 |
| --- | --- | --- | --- |
| `max-depth` | 4 | 4 | 実測の最大の縁（4、2 箇所） |
| `max-params` | 3 | 2 | 不変条件から決める |
| `max-lines-per-function` | 50 | 200、テストのみ 320 | 実測の最大の縁（実装 188 / テスト 313） |

`max-depth` は実測の最大がちょうど 4 で、既定と同値になった。同値でも設定側に書くのは、この 4 が oxlint の都合ではなく mst の予算であることを示すためである。

**`max-params` だけ、実測ではなく不変条件から決める。** 値は 2 にする。

このルールが守るのは「3 つ目の入力が必要になったら、それらは名前を持つ 1 つの概念である」という不変条件で、行数のような代理指標ではない。代理指標には本来あるべき値が無いので実測から決めるしかないが、不変条件にはある。不変条件の閾値を現状の実測に合わせると、現状が不変条件を満たしていないという事実の側に閾値が譲ることになる。

このドキュメントは当初 `max-params` を 4 に置いていた。実測の最大が 4（7 箇所）だったので [0007](0007-name-the-scope-and-the-initial-budget.md) の「予算は実測の最大のすぐ上に置く」に従った結果だが、当てはめる先を誤っていた。上限 4 は「4 個までは束ねなくてよい」と宣言していたことになる。位置引数が 3 つ並んでいる時点で、その 3 つが何の組なのかは呼び出し側から失われている。

2 にした時点の違反は 25 箇所で、すべて署名を作り直した。引数を減らすために処理を削った箇所は無い。

`max-lines-per-function` が数えるのはコード行である。`skipBlankLines` と `skipComments` をどちらも true にした。既定はどちらも false で物理行を数える。[0007](0007-name-the-scope-and-the-initial-budget.md) がファイルの予算で物理行を採らなかったのと同じ理由で、予算に近づいた関数で最初に起きることを「説明を削る」にしたくない。

**`max-lines-per-function` だけ、テストに別の予算を置く。** `overrides` で `**/*.test.ts` / `**/*.test.tsx` を 320 にする。[0007](0007-name-the-scope-and-the-initial-budget.md) はファイルの予算で種別を分けなかったが、それは実装 385 行・テスト 382 行で差が数字に出ていなかったためである。関数では実装 188 行・テスト 313 行と差が出ている。

**`categories.correctness` を error にし、warn を 1 本も残さない。** `vp lint --print-config` が返す 139 本のうち、128 本が warn だった。`no-unused-vars` / `no-unreachable` / `no-constant-condition` と、`oxc/*` `typescript/*` `unicorn/*` `vitest/*` の大半がここに入る。`categories` を書いていなかったので、oxlint の既定である「correctness は warn 相当」がそのまま効いていた。

`AGENTS.md` の重大度の規約に照らすと、この 128 本は「人間に確認せず無視してよいもの」に分類されていたことになる。1 本ずつ見て、そこに該当するものは無かった。

判断が要るのは `vitest/warn-todo` である。名前のとおり warn で使うことを想定したルールで、`test.todo` を報告する。mst ではこれも error にする。`test.todo` は「あとで書く」を期限も担当も無い形でコードに残すもので、mst の規約が先送りとして禁じているものそのものだからである。todo を置いた時点で CI が落ちるのは、その規約をテストに当てはめた結果であって、ルールの意図に反する使い方ではない。

warn のままでは検出されても CI が落ちない。`vp check` は warning だけなら終了コード 0 を返す。`unicorn/no-new-array` の違反を 1 件置いて実測すると、`categories` 無しでは `warning` と表示されて exit 0、`categories` を書くと `error` と表示されて exit 1 になる。[0002](0002-place-quality-gates.md) が置いた品質ゲートは、この 128 本については機能していなかった。

## 影響

`max-depth` と `max-lines-per-function` の予算は実測の最大の 1 つ上にある。次にブロックを 1 段深くする変更、関数を伸ばす変更が最初に当たる。当たったときの行き先は分割であって、予算の引き上げではない。

`max-params` は違う。実測の縁ではなく不変条件の側にあるので、3 つ目の入力を足す変更は常に当たる。当たったときの行き先は「その 3 つが何の組なのかを決めて名前を付ける」ことで、既存の 25 箇所もすべてそう直した。束ねた入力には `ImportSite` / `BindingResolution` / `LintedSource` / `LiteralOccurrence` のような名前が付いている。上限 2 は 1 つの主語と 1 つの名前付き入力を許す形で、`(node, resolution)` のように主語を位置引数のまま残せる。

束ねると呼び出し側は行数が増える。`no-strict-canonical-literal-use--use-canonical-import.test.ts` は 382 コード行から 400 コード行になり、[0007](0007-name-the-scope-and-the-initial-budget.md) が置いた 400 行の予算にちょうど届いた。次にこのファイルへシナリオを足す変更が予算に当たる。

型 import の綴りが変わった。同じモジュールから値と型を取るときは値の import に `type` 修飾子を付けて 1 本にする。これまでの「値の import 群、空行、`import type` 群」という並びは、値を取っていないモジュールについてだけ残る。

テストの予算は `.test.ts` / `.test.tsx` の綴りだけを見る。mst の規約がテストを対象と同階層の `.test.ts` に固定しているので、この 2 つで漏れない。[0007](0007-name-the-scope-and-the-initial-budget.md) が書いたとおり `.spec.` は mst に存在しないので入れていない。

`max-lines-per-function` の `IIFEs` は既定の false のままで、即時実行関数は行数に数えない。

重大度を `categories` で上げたので、oxlint が今後 correctness に足すルールも error として届く。新しいルールが増えた版に上げた時点で CI が落ちうるが、落ちたものは無視してよいものではない、というのが `AGENTS.md` の規約の意味である。`vp lint --print-config` の差分は severity の変更 128 件だけで、ルールの増減も `plugins` の変化もオプションの変化も無い。

## 検討して採らなかった案

**`max-params` を実測の最大である 4 に置く。** これは当初の決定で、後から取り消した。理由は決定の側に書いた。4 引数を束ねると名前が「options」以上のものにならない、という見立ても実際には成り立たなかった。25 箇所すべてに、呼び出し側で意味の分かる名前が付いた。

**`max-params` を 1 にする。** すべての関数が 1 つのオブジェクトを取る形になる。主語と文脈の区別が消えて、`isArrayLikeExpression(node, resolution)` のような「何を調べるか」と「どういう文脈で調べるか」の分かれ方まで 1 つのオブジェクトに畳まれる。不変条件が言っているのは「3 つ目が要るなら名前を付けろ」であって「常に 1 つにしろ」ではない。

**`max-lines-per-function` をテストにも 200 で効かせ、テーブルを分割する。** 200 行を超えるテストの本体は `RuleTester` に渡す `valid` / `invalid` の配列で、長さはシナリオの数であって制御構造の複雑さではない。分割してもシナリオは減らず、`it` の数が増えるだけになる。

**`max-lines-per-function` を単一の 320 にする。** 実装側の最大が 188 なので 130 行以上の余裕ができ、実装に対して予算が当たらなくなる。[0007](0007-name-the-scope-and-the-initial-budget.md) の「予算は当たって初めて仕事をする」に反する。

**`--deny-warnings` で CI だけ落とす。** 設定を読んでも重大度が分からず、実行方法を見に行かないと「このリポジトリではこれは error である」が分からない。手元の `vp check` と CI で結果が食い違う形にもなる。

**128 本を個別に `LINT_SEVERITY.ERROR` で並べる。** 現在の 128 本は error になるが、oxlint が correctness に足す次のルールは warn のまま入ってくる。同じ作業を版が上がるたびに繰り返すことになり、繰り返し忘れた分が静かに warn として溜まる。
