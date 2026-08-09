# 0003. Node のバージョンを devEngines.runtime に集約する

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

`.node-version` をやめて `.tool-versions` に置き換えたい、という要望が出発点だった。手元では mise が node 以外のツールも含めて環境を管理しており、node のバージョンだけ別ファイルで持つのは形が揃わない。

前提として、このリポジトリの node のバージョンを読む主体は3つある。ローカルの `vp`、CI の `voidzero-dev/setup-vp`、そして手元の mise である。3者が別々のファイルを見ると、片方だけが更新されたときに黙って食い違う。

## 決定

`.node-version` を削除し、`package.json` の `devEngines.runtime` に集約する。`.tool-versions` は採らない。

```json
"devEngines": {
  "packageManager": { "name": "pnpm", "version": "11.20.0", "onFail": "download" },
  "runtime": { "name": "node", "version": "24.19.0", "onFail": "download" }
}
```

キーの並びは oxfmt がソートするため、`runtime` を先に書いても `packageManager` の後ろに移動する。

`engines.node` の range はそのまま残す。[Vite+ のドキュメント](https://viteplus.dev/guide/env)が書いているとおり、`devEngines.runtime` は開発環境の要求、`engines.node` は利用者に対するサポート範囲であり、役割が違う。

## `.tool-versions` を採らなかった理由

`vp env` は `.tool-versions` を読まない。バージョンの解決ソースは、ディレクトリを親に遡りながら各ディレクトリ内で次の順に見るだけである。

1. `.node-version`
2. `package.json` の `devEngines.runtime`
3. `package.json` の `engines.node`
4. `.nvmrc`

`.tool-versions` だけを置いたディレクトリで `vp env current` を実行すると `Source: lts` になり、どのファイルも認識されずグローバル既定にフォールバックする。ここに `engines.node` を足すとそちらが拾われる。

これは実装漏れではなく上流の方針である。`vp env` を mise 相当の汎用ランタイムマネージャに広げる提案は [voidzero-dev/vite-plus#984](https://github.com/voidzero-dev/vite-plus/issues/984) で「out of scope for Vite+ at this time」としてクローズされ、他のランタイムは他のバージョンマネージャに任せる立場が明示されている。一方で `.nvmrc` の追加（[voidzero-dev/vite-plus#2207](https://github.com/voidzero-dev/vite-plus/issues/2207)）は受け入れられた。Node エコシステム由来のファイルは足すが、asdf/mise のマルチツール形式は足さない、という線引きになっている。

紛らわしいことに、CI 側の `setup-vp` は `.tool-versions` を読める。[`src/node-version-file.ts`](https://github.com/voidzero-dev/setup-vp/blob/313600b80b104eadebb9111787d37a2e83e014ca/src/node-version-file.ts) は asdf 形式をパースし、`nodejs` または `node` 行から `system` / `ref:` / `path:` を除いた最初のバージョンを返す。`package.json` を指した場合は `devEngines.runtime` を優先し、なければ `engines.node` に落ちる。

つまり `.tool-versions` にすると CI だけが動き、ローカルの `vp` は `engines.node` の range 解決に落ちる。今はどちらも 24.19.0 に解決されるので差が見えないが、新しい LTS が出た時点で手元と CI が黙って乖離する。

## 3者が同じ1行を読むこと

`devEngines.runtime` は `vp`・`setup-vp`・mise の3者すべてが読む唯一の形式である。

`vp env current` は `Source: devEngines.runtime` を報告する。`setup-vp` は上記のとおり `package.json` から `devEngines.runtime` を優先で読む。mise は idiomatic version file の一種として `package.json` を読み、`mise ls --current` の node 行に `package.json` が出典として表示される。

なお mise は `engines.node` は読まない。`engines.node` だけを置いたディレクトリでは mise はグローバル既定にフォールバックした。`devEngines.runtime` を書かずに `engines.node` の range だけで済ませる案が成立しないのはこのためである。

mise 側の注意として、`.node-version` や `package.json` を読むには `idiomatic_version_file_enable_tools` に `node` が含まれている必要がある。mise 2025.10.0 以降、idiomatic version file の解釈は既定で無効になった（[jdx/mise#4345](https://github.com/jdx/mise/discussions/4345)）。この設定を空にすると mise は `devEngines.runtime` も `.node-version` も読まなくなる。これは `.node-version` を使い続けた場合も同じ条件なので、今回の変更で新たに増えた制約ではない。

## 将来 node 以外のツールを管理するとき

node 以外のツール（actionlint、shellcheck、Go、Python など）を pin する必要が出たら、`mise.toml` を追加してそこに書く。`mise.toml` に node を書いてはいけない。

この分割が成立することは実測で確認している。`mise.toml` に他ツールだけを書き、node を書かない状態では、mise は他ツールを `mise.toml` から、node を `package.json` から解決する。`vp` の解決は `mise.toml` の存在に影響されない。node の出所は `package.json` の1箇所に保たれる。

`.tool-versions` ではなく `mise.toml` を選ぶ理由は2つある。第一に、`vp` はどちらも読まないため node の管理先としては同じく不適で、選択の基準は node 以外の表現力になる。第二に、asdf 形式は `go:` / `npm:` / `ubi:` といった backend 指定を表現できない。mise でツールを増やすなら `mise.toml` の方が素直である。

CI で node 以外のツールも必要になった時点で、`jdx/mise-action` を CI に足すことになる。その際も node のインストールは `setup-vp` の担当のままにし、mise には node を触らせない。

## 影響

CI の `node-version-file` は `.node-version` から `package.json` に変わる。

Renovate は `devEngines.runtime` を依存として抽出しない（[renovatebot/renovate#38067](https://github.com/renovatebot/renovate/issues/38067) が OPEN）。`.node-version` は nodenv manager が管理していたが、その経路がなくなるため、`devEngines.packageManager` に対して既に置いている jsonata の customManager に `runtime` 用の matchString を足した。これがないと `matchPackageNames: ["node", "@types/node"]` のルールが発火せず、node の更新が静かに止まる。datasource は `node-version`、versioning は `node` を指定している。

この点は [0002](0002-place-quality-gates.md) の「`.node-version` を置いて `node-version-file` で参照すれば nodenv manager が管理する」という記述を置き換える。

リポジトリからトップレベルのドットファイルが1つ減り、ランタイムとパッケージマネージャの宣言が `package.json` に並ぶ。
