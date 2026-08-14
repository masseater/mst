# 0059. barrel を 2 本のルールで禁じ、どちらも preset に載せない

- ステータス: Accepted
- 日付: 2026-08-14

## 文脈

再エクスポートだけでできたモジュール（barrel）は、値の解決をそこへ集める。集めた結果として 3 つのことが起きる。

バンドラが barrel を通り抜けるには、転送先のモジュールがすべて副作用を持たず、ESM で、`sideEffects` が宣言されている必要がある。1 つでも欠ければ、barrel から名前を 1 つ取っただけで転送先の全部が残る。[vercel/next.js#12557](https://github.com/vercel/next.js/issues/12557) が、約 100 個のコンポーネントを barrel 経由で読んだアプリで、実際に使うのは数個でも共有チャンクに全部が入る事象を記録している。

tree shaking は本番ビルドの最適化でしかない。開発サーバも、テストランナーも、型検査も、モジュールグラフを書かれたとおりに解決する。Angular は linker から TypeScript への依存を外す変更で原因を barrel file 経由の import と名指しし、「By removing the usage of this barrel file and restructuring the imports to be more granular, we can avoid unnecessary TypeScript imports」と書いている（[angular/angular#61618](https://github.com/angular/angular/pull/61618)、merged）。この変更が取り除いたのはアプリケーションのコンパイル時間 500ms から 1s である。

そして `import { total } from "./models"` と書かれたコードからは、`total` を宣言しているモジュールが読めない。読むには barrel を開いて転送先をたどることになる。

## 決定

**2 本のルールとして書く。** `no-barrel-module--declare-in-the-owning-module` が転送だけでできたファイルを、`no-barrel-import--import-from-the-owning-module` がそういうファイルを名指しした指定子を報告する。

分けたのは直し方が違うためである。前者は「そのファイルを消す」、後者は「宣言しているモジュールを名指しする」になる。[@mst/dont-review-it の境界](../../packages/dont-review-it/AGENTS.md)が直し方の一意さをルールの条件にしているので、2 つの直し方を 1 本に畳まない。分かれていることで、面を持たないリポジトリが読む側だけを有効にする、という採り方も残る。

**型だけを転送する形と、型だけを取る形は報告しない。** 上の 3 つはいずれも値の解決に由来し、型はビルドで消える。`export type { T } from "..."` と、すべての specifier に `type` が付いた形が該当する。このリポジトリは `typescript/consistent-type-imports` を `fixStyle: "inline-type-imports"` で有効にしており、型だけの取り込みが `import { type T }` の綴りで現れるので、宣言の `importKind` だけでなく specifier まで見る。

**判定は 1 ファイルの構文で閉じる。** 転送先が実際に何を宣言しているかは読まない。`no-barrel-import` が見るのは指定子の綴りだけで、相対指定であることと、最後のセグメントの拡張子を落とした綴りが `index` であること（またはディレクトリで終わること）を条件にする。名前の慣習に乗った判定であり、実体を見た判定ではない。届かない範囲は両方の文書に書いた。

**循環参照はこの 2 本の理由に数えない。** barrel の下で循環は起きやすくなるが、循環そのものを見る不変条件は [`import/no-cycle`](https://oxc.rs/docs/guide/usage/linter/rules/import/no-cycle) が持つ。判定にモジュールグラフ全体を要するルールで、このリポジトリはまだ有効にしていない。自前のルールの理由に借りると、公式のルールが守る不変条件を自前で書いたことになる。

**どちらも出荷する preset に載せない。** [EDR 0058](0058-let-a-rule-declare-that-the-shipped-preset-leaves-it-out.md) が設けた宣言を両方の meta に書く。

このリポジトリは公開面を `src/index.ts` の再エクスポートで表しており、[EDR 0018](0018-narrow-the-export-surface-to-what-is-used.md) が knip の `includeEntryExports` を有効にして、その面に載っている名前が実際に使われているかを検査している。面をやめると、この検査が見る対象が無くなる。同じ理由で `require-re-export-only-files--move-declaration-to-owning-module` を `**/index.ts` に対して有効にしており、そちらは「対象に挙げたファイルは再エクスポートだけを持て」と要求する。2 本は同じファイルについて正反対を要求するので、同時には成り立たない。

どちらを採るかは採用者の構成についての判断そのものであり、[EDR 0058](0058-let-a-rule-declare-that-the-shipped-preset-leaves-it-out.md) が載せない条件として書いたものに当たる。

**`no-barrel-module` だけが `exclude` を持つ。** パッケージの公開エントリは、外から見た入口として 1 つあるべきものである。読む側の `no-barrel-import` は、パッケージの外から公開エントリを読む指定子がパッケージ名で書かれて相対指定にならないので、除外の口を持たない。

## 公式のルールを採らなかった理由

oxlint は [`oxc/no-barrel-file`](https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-barrel-file.html) を持っている。[EDR 0024](0024-let-the-official-rule-stand-unless-its-message-cannot-decide-the-fix.md) が「公式のルールは、その報告文が修正を決められないときにだけ自前へ置き換える」と定めているので、まずこれを検討した。

置き換えたのは報告文の問題ではなく、守っている不変条件が違うためである。このルールが見るのは `export *` を持つファイルで、転送されるモジュールの総数が閾値を超えたときにだけ報告する。既定の閾値は 100 である。名前付きの再エクスポート `export { foo } from "./foo"` は報告せず、公式の文書はそれを正しい書き方として提示している。[提案の issue](https://github.com/oxc-project/oxc/issues/3004) も Biome の `export *` だけを見る実装を出発点にしており、そこへモジュールグラフから数えた依存の総数を足す方向で実装された。

つまり `oxc/no-barrel-file` が守るのは「ワイルドカードで大量に転送するファイルを置かない」であって、「転送だけのファイルを置かない」ではない。上に書いた 3 つはどれも転送の件数ではなく転送そのものから来るので、閾値を 1 まで下げても同じ不変条件にはならない。名前付き再エクスポートが対象から外れたままだからである。

同じ不変条件を見ている公式のルールが無いので、off にするものも無い。`oxc/no-barrel-file` はこのリポジトリで有効になっていない。

読む側については `eslint/no-restricted-imports` の `patterns` で書ける。採らなかったのは、`forbid-generic-restriction-rule--use-the-declared-rule` が、禁止する対象を自分の設定から読む既製のルールを有効にすること自体を禁じているためである。

## 影響

このリポジトリの lint の結果は変わらない。どちらも配られないので、`vite.config.ts` が名前を書かない限り 1 件も報告しない。

面を持たない構成を採るリポジトリは、2 本を `rules` に書いて有効にし、`require-re-export-only-files--move-declaration-to-owning-module` を外すことになる。逆の構成では今までどおり後者だけが効く。preset はどちらも決めない。
