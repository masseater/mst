# no-barrel-module--declare-in-the-owning-module

このルールは出荷する preset に載っていない。使う側が名前を書いて初めて効く。理由は「既定で配らない理由」に書いた。

## 何を検出するか

Program 直下の文がすべて「モジュールソースを伴うエクスポート文」であり、そのうち少なくとも 1 つが値を運んでいるファイル。報告はファイル全体（Program ノード）に 1 件だけ出す。

再エクスポートとして数えるのは次の 2 つである。

- `export ... from "..."`（`source` を持つ `ExportNamedDeclaration`）
- `export * from "..."` / `export * as ns from "..."`（`ExportAllDeclaration`）

値を運んでいるかは、次のように判定する。

- `export * from "..."` は値を運ぶ。`export type * from "..."` は運ばない
- `export { ... } from "..."` は、`type` の付いていない specifier が 1 つでもあれば運ぶ。`export type { ... } from "..."` と、すべての specifier に `type` が付いた形は運ばない

したがって、型だけを転送するファイルは報告しない。転送する名前のうち 1 つでも値であれば報告する。

宣言・import・式文・`export default`・ディレクティブのいずれかが 1 つでもあれば、そのファイルは再エクスポートだけでできていないので報告しない。

## `require-re-export-only-files` との関係

このルールと [require-re-export-only-files--move-declaration-to-owning-module](require-re-export-only-files--move-declaration-to-owning-module.md) は、同じファイルについて正反対を要求する。片方は「対象に挙げたファイルは再エクスポートだけを持て」と言い、こちらは「再エクスポートだけのファイルを置くな」と言う。

同時に有効にすると、対象に挙げたファイルはどちらの要求も満たせない。2 本のうちどちらを採るかは、公開面をどう表すかの選択であって、両方を採る選択は無い。

## なぜそれが要るか

理由は 3 つの層に分かれ、いずれも値の解決に由来する。型だけを転送するファイルを報告しないのはこのためである。

**1 層目は、バンドラが barrel を通り抜けるには条件が要ることである。** 転送される先のモジュールがすべて副作用を持たず、ESM で、`sideEffects` が宣言されている必要がある。1 つでも欠けると、barrel から名前を 1 つ取っただけで転送先の全部がバンドルに残る。クラスフィールド・デコレータ・列挙型がトランスパイル後に副作用のある式として出ることがあり、そこに `/*#__PURE__*/` が付かなければ同じことが起きる。[vercel/next.js#12557](https://github.com/vercel/next.js/issues/12557) は、約 100 個のコンポーネントを barrel 経由で読んだアプリで、実際に使うのは数個でも共有チャンクに全部が入る事象を記録している。

**2 層目は、tree shaking が本番ビルドの最適化でしかないことである。** 開発サーバも、テストランナーも、型検査も、モジュールグラフを書かれたとおりに解決する。barrel から 1 つ取ると、その barrel が指すモジュール全部が解析され、初期化される。Angular は linker から TypeScript への依存を外す変更で、原因を barrel file 経由の import と名指しし、「[By removing the usage of this barrel file and restructuring the imports to be more granular, we can avoid unnecessary TypeScript imports](https://github.com/angular/angular/pull/61618)」と書いている。この変更が取り除いたのはアプリケーションのコンパイル時間 500ms から 1s である。ここで効いているのは本番の成果物の大きさではなく、開発中に毎回払う時間である。

**3 層目は、名前とその所有者の対応が失われることである。** `import { total } from "./models"` と書かれたコードから、`total` を宣言しているモジュールは読めない。読むには barrel を開き、転送先をたどることになる。この 1 段は、名前が増えるほど、転送が入れ子になるほど深くなる。

循環参照はこの構造の下で起きやすくなるが、循環そのものを見る不変条件はこのルールが持つものではない。それは [`import/no-cycle`](https://oxc.rs/docs/guide/usage/linter/rules/import/no-cycle) が持ち、判定にモジュールグラフ全体を要する。このルールは 1 ファイルの構文だけを見る。

## 公式のルールを採らなかった理由

oxlint は [`oxc/no-barrel-file`](https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-barrel-file.html) を持っている。ただし守っている不変条件が違う。

このルールが見るのは `export *` を持つファイルで、転送されるモジュールの総数が閾値を超えたときにだけ報告する。既定の閾値は 100 である。名前付きの再エクスポート `export { foo } from "./foo"` は報告せず、公式の文書はそれを正しい書き方として提示している。[提案の issue](https://github.com/oxc-project/oxc/issues/3004) も、Biome の実装が `export *` だけを見ていることを出発点にしており、そこへモジュールグラフから数えた依存の総数を足す方向で実装されている。

つまり `oxc/no-barrel-file` が守るのは「ワイルドカードで大量に転送するファイルを置かない」であって、「転送だけのファイルを置かない」ではない。上の 3 層はどれも転送の件数ではなく転送そのものから来るので、閾値を下げても同じ不変条件にはならない。

## どう直すか

barrel を消し、それを読んでいたモジュールが、名前を宣言しているモジュールを直接名指しする。

面を 1 か所に固定したいという要求がこのファイルを生んでいる場合、その要求はパッケージの公開エントリだけが持つ。パッケージの外から見た入口は 1 つであるべきで、そこは `exclude` で外す。パッケージの中では、入口を経由せずに宣言しているモジュールを名指しする。

## 禁じる回避策

- 抑制ディレクティブで黙らせ、転送だけのファイルを残す。転送の構造は変わらないので、上の 3 層はそのまま残る
- 転送に加えて意味のない文を 1 つ置き、「転送だけのファイル」でなくする。判定は形だけを見るので報告は消えるが、消えるのは報告だけである
- 値の転送を型の転送に見せかける。`export type` を付けた名前は、読む側から値として使えない
- 転送先を 1 段増やし、転送だけのファイルを 2 枚にする。どちらのファイルも報告される

## オプション

対象から外すファイルの指定だけを取る。

- `exclude`（任意・glob）: 検査から外すファイルを選ぶ。パッケージの公開エントリを外す用途

照合は [require-re-export-only-files--move-declaration-to-owning-module](require-re-export-only-files--move-declaration-to-owning-module.md) の `exclude` と同じ規則で行う。

対象を絞る `targets` は持たない。このルールは「面として置かれたファイル」ではなく「転送だけでできたファイル」を形から判定するので、どのファイルを見るかを利用側が決める必要が無い。

## 既定で配らない理由

このリポジトリは公開面を `src/index.ts` の再エクスポートで表しており、[EDR 0018](../../../../docs/engineering-decision-logs/0018-narrow-the-export-surface-to-what-is-used.md) が knip の `includeEntryExports` を有効にして、その面に載っている名前が実際に使われているかを検査している。面をやめると、この検査が見る対象そのものが無くなる。

同じ理由で、このリポジトリは [require-re-export-only-files--move-declaration-to-owning-module](require-re-export-only-files--move-declaration-to-owning-module.md) を `**/index.ts` に対して有効にしている。上に書いたとおり、2 本は同時には成り立たない。

したがって、どちらを採るかは採用する側の構成で決まる。パッケージの公開面を再エクスポートで表す構成なら前者を、面を持たず宣言しているモジュールを常に名指しする構成ならこちらを採る。出荷する preset はこの選択を決めない。

## 検出が届かない範囲

宣言を 1 つでも持つファイルは報告しない。転送が主で宣言が 1 つだけのファイルは、読む側から見れば barrel と変わらないが、このルールの入口に入らない。

外部パッケージが提供する barrel は見ない。読む側にはそのパッケージの中身を組み替える手段が無く、報告しても修正指示が成り立たない。

`export ... from` の転送先が実際に何を宣言しているかは読まない。判定は 1 ファイルの構文で閉じる。
