# 0037. workspace manifest の列挙に Node.js の glob を使う

- ステータス: Accepted
- 日付: 2026-08-11

## 文脈

[0028](0028-keep-the-catalog-for-shared-versions-only.md) は、workspace manifest の列挙を `dir/*` と直書きに限り、`**` と `!` を読み飛ばすことを決めた。catalog 検査だけを考えれば、読めない pattern を対象外にすることで誤報は避けられた。

同じ manifest 列挙を test command の検査にも使うと、読み飛ばした package が coverage 設定を CLI で上書きしても検査対象に入らない。これは誤報を避ける境界ではなく、main の gate を狭める迂回経路になる。

Node.js の標準 `fs.globSync` は、現在固定している runtime で stable であり、複数の正の glob と除外 pattern を解釈できる。pnpm の pattern 解釈を自作する必要はない。

## 決定

**workspace manifest の列挙に `fs.globSync` を使う。** 直書き、`*`、再帰する `**` を正の pattern として展開する。`!` で始まる workspace pattern は、先頭の `!` を外して `exclude` に渡す。

**root `package.json` は workspace 定義の有無にかかわらず列挙する。** 単一 package repository の test command と、monorepo root の gate script を同じ検査に通す。

この決定は、[0028](0028-keep-the-catalog-for-shared-versions-only.md) が workspace pattern を `dir/*` と直書きに限った境界を置き換える。catalog を共有バージョンだけに限る判断と、依存 version の不一致をどう報告するかは変更しない。

## 影響

- nested workspace の catalog 宣言と test command も検査対象に入る
- negated workspace pattern に一致する manifest は検査対象から外れる
- workspace 定義が無い repository でも root test command の設定差し替えと coverage CLI 上書きを検出する

## 検討して採らなかった案

**`dir/*` だけを維持し、test command の検査だけ別の列挙器を持つ。** 同じ workspace 集合に 2 つの解釈ができ、catalog と test で対象 package がずれるため採らない。

**pnpm の glob 解釈を自作する。** runtime の標準 API が必要な正の glob と除外を扱える。別の parser を所有する理由がないため採らない。
