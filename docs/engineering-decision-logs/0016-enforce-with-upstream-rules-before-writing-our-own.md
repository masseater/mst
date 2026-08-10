# 0016. 既製のルールで守れるものは既製のルールに守らせる

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

`@mst/dont-review-it` の base preset は、自前ルールと、[0012](0012-adopt-oxlint-rules-that-are-off-by-default.md) と [0014](0014-bound-function-size-and-forbid-numbered-splits.md) が名前で選んだ組み込みルールを宣言していた。選び方はどちらも「oxlint に実装があって使っていないもの」の側から探す形で、参照実装がどこまで有効にしていたかは見ていない。

参照実装の共有プリセットを読んで突き合わせたところ、差は 2 種類あった。

**完全に無効だったもの: 103 本。** `typescript/*` 60、`vitest/*` 24、`import/*` 6、`promise/*` 4、コア 11。`import` と `promise` は `plugins` に入っていないため、設定に名前を書いても発火しない状態だった。

**warn 止まりだったもの: 66 本。** `vp lint` は warning だけなら exit 0 を返す。[0002](0002-place-quality-gates.md) が置いた門を通り抜けるので、宣言はされているが何も止めていなかった。

差の内訳を見ると、選び方の問題が形になっている。名前で探す形は、探した人が知っている検査しか見つけられない。型情報を要求する `typescript/*` の 47 本は、まとめて 1 つの姿勢（型で表現できることは型で止まる）を作って初めて効くもので、1 本ずつ眺めていて価値が分かるものではない。

## 決定

**参照実装が error で有効にしていた第三者ルールを、名前を 1 本ずつ列挙して入れる。** カテゴリ単位の有効化には乗らない。oxlint がカテゴリの中身を増減させたときに、このリポジトリの姿勢が誰の判断も経ずに動くのを避けるためである。`categories` を使うのは、`correctness` を error へ引き上げる 1 行だけに留める（これは severity の宣言であって、どのルールを選ぶかの宣言ではない）。

**`plugins` は preset が完全なリストを持つ。** oxlint の `plugins` は追加ではなく置換で、`extends` した先が書いた内容は外側が書いた内容に上書きされる。root の `vite.config.ts` が `["unicorn", "typescript", "oxc", "vitest"]` を書いていたため、preset 側で `import` と `promise` を足しても効かなかった。root から `lint.plugins` を外し、preset 側に 6 つを置いた。変更前後の `vp lint --print-config` を突き合わせ、消えたルールが 0 本であることを確認している。

**抑制コメントの扱いを設定で固定する。** 使われていない抑制ディレクティブを error にし、他のリンタ向けの抑制コメントを尊重しない。抑制は「今そこに違反がある」ことの表明であって、将来のための予約ではない。違反が消えたら抑制も消える状態を機械で保つ。

**閾値を持つテスト側の 2 本は、既定より緩くしない。** `vitest/max-nested-describe` は 2（既定 5、実測の最大 2）。top-level describe が subject を名乗り、その内側で 1 段だけ束ねてよい、という形にした。3 段目が要るなら、そのファイルが 2 つ以上の subject を持っている。`vitest/no-large-snapshots` は既定のまま入れた。mst にはインラインスナップショットも `.snap` ファイルも 1 つも無く、測るものが存在しないためである。最初の 1 つが書かれたときに既定が当たる。

**oxlint に実装が無いものは、自前で書けるものだけ書く。** 参照実装が ESLint 側に持っていた検査を oxlint のカタログ 847 本と突き合わせた。品質プラグインの推奨集合は、名前で数えた範囲では大半に oxlint 側の同名または同等の実装がある（`no-lonely-if` / `no-else-return` / `no-nested-ternary` / `no-unneeded-ternary` / `no-useless-return` / `no-self-compare` / `prefer-object-spread` / `no-implicit-coercion` / `no-param-reassign` などを個別に確認した）。全件を突き合わせたわけではない。残ったのは 2 つで、どちらも自前で書いた。

- `no-unordered-import--group-by-origin-then-sort-by-specifier` — import の並び。整形器は並べ替えないことを実測で確認した（指定子を崩したファイルに `vp fmt --write` をかけても順序は変わらない）
- `no-multi-binding-declaration--declare-one-binding-per-statement` — 1 つの宣言文が導入する束縛は 1 つ

`one-var` に相当するものは oxlint に無く、`import/order` も無い。この 2 本はその穴を埋めている。JSON を対象にする検査だけは埋めていない。oxlint が JS/TS 以外を読まないためで、これは別の経路（検証コマンド）で扱う問題である。

## 影響

**型の嘘が通らなくなった。** `any` の明示と暗黙の侵入、型アサーションによる握り潰し、非 null 断言、`unknown` を経由しない catch 変数が止まる。`no-explicit-any` だけでは足りず `no-unsafe-argument` / `no-unsafe-assignment` / `no-unsafe-call` / `no-unsafe-member-access` / `no-unsafe-return` を揃えて初めて「侵入を止める」が成立する。

**共有 tsconfig に `noUncheckedIndexedAccess` と `noUnusedParameters` が入った。** どちらも第三者ルールの副作用として要った。

`no-unnecessary-condition` は、`const [x] = arr;` の直後の `x === undefined` ガードを「型上は不要」として 8 か所で報告した。ガードは実行時には必要で、消せば保護が失われる。報告が正しくないのは配列の添字が嘘の型を持っているからなので、ルールを緩めるのではなく型の側を正した。型エラーは 33 件出て、すべて直している。

`noUnusedParameters` は `no-unused-vars` を oxlint 側で off にしたことの対である。未使用の検査は型検査器に権威を寄せたが、共有 tsconfig にあったのは `noUnusedLocals` だけで、引数側は誰も見ていなかった。

**テストファイルは top-level describe を持つ。** `vitest/require-top-level-describe` を有効にしたことで 22 ファイルに describe が付いた。subject はモジュール名で、`no-detached-test-file--move-beside-source` が保証する「テストは対象の隣にある」という関係をそのまま名前にしている。

この変更は、テストファイルに対する 3 つの数量ルールの意味を変えた。ファイル全体が describe のコールバック 1 個になるので、そこで関数を測る指標は関数ではなくファイルを測る。

- `max-lines-per-function`（[0012](0012-adopt-oxlint-rules-that-are-off-by-default.md)）— テストを対象から外した。実測でファイルの 1 つが 375 行になり 320 を超えたが、行き先は予算の引き上げでも分割でもない。ファイル行数は `forbid-oversized-file--split-by-responsibility` の 400 が既に権威を持っており、同じ対象を 2 つの権威が別の数字で測る状態を作らない
- `max-statements`（[0014](0014-bound-function-size-and-forbid-numbered-splits.md)）— 同じ理由でテストから外れている
- `max-nested-callbacks`（[0014](0014-bound-function-size-and-forbid-numbered-splits.md)）— テストから外した。describe と test で入れ子が 2 段消費されるため、テストの中でコールバックを 1 つ使うだけで上限に当たる。数えているのがテストの構造であって手続きの深さではない

3 つとも、値を緩めるのではなく対象から外す形にした。適用しない量に数字を置くと、その数字が何かを宣言しているように読めるためである。

**`no-hooks` によりテストの後始末の形が変わった。** 一時ディレクトリを消す `afterAll` を 4 ファイルから外し、モジュールの読み込み時に固定名のディレクトリを消してから作る形にした。後始末が実行の前に来るので、失敗した実行の中身がそのまま残って読める。

**`promise/prefer-await-to-then` は `no-promise-chain--use-async-await` と重なる。** 自前ルールの方が広く、`.then` / `.catch` / `.finally` を添字記法や省略可能連結まで含めて拾う。参照実装はこれをテストにだけ当てていたが、mst では本体にも当てる。

重なりは実測で確認した。`Promise.resolve(1).then(...)` を仕込むと、同じ位置に 2 本とも error を出す。リポジトリの現状では違反が 0 件なので実害は出ていないが、`.then` を書いた人は 2 つの報告を受け取る。「検出の権威をルールごとに 1 つにする」という本文の方針からは外れており、残しているのは人間の指示による。自前ルールが将来外れたときの受け皿になる。

`import/*` と `promise/*` は新しく `plugins` に入れた系統なので、どちらも違反を仕込んで発火を確認した。`import/default`（既定 export を持たないモジュールからの既定 import）と `promise/no-new-statics`（`new Promise.resolve()`）がそれぞれ error を出す。`--print-config` に名前が出ることは、そのルールが実際に走ることを意味しない。

## 検討して採らなかった案

**`categories` で `pedantic` や `style` をまとめて上げる。** 1 行で済み、oxlint が足したものも自動で入る。採らなかったのは、どのルールを有効にするかがこのリポジトリの判断ではなく上流の分類に従うことになるためである。分類が動いたときに、有効になったルールを誰も選んでいない状態が生まれる。`correctness` だけを一括で上げているのは、あれが「壊れているコード」の分類であって姿勢の選択を含まないからである。

**`import/no-duplicates` を入れる。** 参照実装は入れていたが、mst には [0012](0012-adopt-oxlint-rules-that-are-off-by-default.md) が入れた `no-duplicate-imports` が既にあり、同じモジュールからの重複 import はそちらが権威を持っている。あちらは 30 件を直した実績があり、直し方（値の import に `type` 修飾子を付けて 1 本にまとめる）も確定している。同じ違反を 2 つの検出器が別の直し方で報告する状態を作らない。

**JSON を対象にする検査を入れる。** 参照実装は JSON のリントを ESLint 側に持っていた。oxlint は JS/TS 以外を読まないので、`plugins` に何を足しても JSON には届かない。マニフェストや設定ファイルの検査は、リントではなく独立した検証コマンド（`vp exec dont-review-it verify` と同じ形）で扱う。この作業では触っていない。

**セキュリティ観点のプラグインを自前で書く。** oxlint に相当するプラグインは無い。含まれる検査のうち mst に効きうるものは、正規表現・`eval`・Buffer の生成あたりで、これらは `no-eval` / `no-implied-eval` / `no-new-func` / `no-script-url` / `unicorn/no-new-buffer` が既に見ている。残りは子プロセスの起動やファイルパスの動的生成を対象にするもので、前者は mst に存在せず、後者は有限値カタログの走査が正当に行っている操作なので、入れると大量の偽陽性になる。

**React / Next.js のルールを入れる。** 参照実装はこれらを持っていたが、mst にはどちらのスタックも無い。React のルールはコンポーネントの書き方（hooks の呼び出し位置、key、state の直接変更）を見るもので、React を使っていないリポジトリでは判定対象が存在しない。Next.js のルールも同様に、あのフレームワークが持つファイル配置と特定コンポーネントの使い方に紐づいている。スタックが入った時点で足す。

アクセシビリティのルールは入れた。React とは事情が違い、判定対象が JSX の要素と属性であって特定のフレームワークに紐づいていない。`@mst/dont-review-it` は外部の利用者に配る preset なので、mst 自身に JSX が無くても、受け取った側が JSX を書けばそのまま効く。発火の確認は違反を仕込んで行った（`<img>` に `alt` が無い形で `jsx-a11y/alt-text` が error を出す）。

**品質プラグインとセキュリティプラグインを自前で書き起こす。** 推奨集合に含まれるルールのほぼ全てに oxlint 側の実装があり、残る差は認知的複雑度の指標くらいである。それは `complexity` が別の指標で同じ場所を見ている。ESLint を導入して 2 系統のリンタを併用する形も採らなかった。同じ違反を 2 つの検出器が報告する状態は、片方を黙らせる修正を誘発し、どちらを黙らせるかを書き手が選べてしまう。

**`enum` で import の由来を表す。** 由来の順序は名前を持つ 1 つの語彙なので `enum` が自然だが、Node の型除去ローダーは `enum` を扱えない。`vite.config.ts` から到達する全モジュールが対象になるため、ルールの実装ファイルでは使えない。消去可能な形（`as const` のオブジェクトと、そこから導いたユニオン型）にしてある。
