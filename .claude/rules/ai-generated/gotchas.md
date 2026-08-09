---
paths:
  - "**"
---

# Vite+ (mst) の落とし穴

このリポジトリで実際に踏んだ、コードを読んでも分からない事実だけを記録する。一般的な TypeScript の書き方や Vite+ の基本的な使い方は扱わない。

各項目は「症状 → 原因 → 対処」で読める形にしている。

## npm 経由でグローバル導入した vp は `vp test` を壊す

- 症状: `vp test` および `vp run -r test` が `Vitest failed to find the current suite` で必ず失敗する。`vp check` は通ってしまうため、CLI の導入経路が原因だとは気づきにくい
- 原因: npm パッケージ版の vp は自分に同梱された vitest でテストを起動する。一方でテストファイル側はプロジェクトローカルの `vite-plus/test` を解決するため、vitest のインスタンスが二重になる
- 実測: mise の `npm:vite-plus@0.2.8` で失敗、公式インストーラのネイティブ vp 0.2.8 で成功、プロジェクトローカルの `./node_modules/.bin/vp` でも成功。バージョンは全て同一
- 上流: [voidzero-dev/vite-plus#2097](https://github.com/voidzero-dev/vite-plus/issues/2097)（OPEN）で「`npm -g install vite-plus` は簡単に実行できてしまうが、それは期待されるグローバル CLI ではない」と明言されている。警告を出す実装を検討中。公式ドキュメントもインストール手段として curl のインストーラしか案内していない

対処:

- IF: vp をグローバルに導入する; THEN
  - MUST: 公式インストーラ（`curl -fsSL https://vite.plus | bash`）を使う
  - PROHIBIT: mise の global config に `vp` エントリを置く

## テンプレートが入れる `vite` 直接依存を「未使用」と判断して消してはいけない

- 症状: knip がルートと `packages/utils` の `vite` を未使用 devDependency として報告する。実際にソースからは参照されていない
- 消すとどうなるか: pnpm では `overrides` が実際の `vite` 依存エッジを持つワークスペースにしか効かない。直接依存のないワークスペースでは autoInstallPeers が上流の素の vite を別途インストールし、vite/vitest が二重インスタンス化する。これは前項と同じ構造の障害（`vp test` のキャッシュミス、dual instance）を招く
- 上流: [voidzero-dev/vite-plus#1932](https://github.com/voidzero-dev/vite-plus/issues/1932)。テンプレートが root と `packages/utils` に直接 `vite` 依存を入れているのは、まさにこの対策として入れられたもの
- 併せて必須の設定: `catalog` の `vite: npm:@voidzero-dev/vite-plus-core@<version>` エイリアスと `overrides.vite: "catalog:"`（[voidzero-dev/vite-plus#2034](https://github.com/voidzero-dev/vite-plus/issues/2034) でコラボレータが「想定どおり」と回答）。`peerDependencyRules` は機能上は任意で、外すと unmet peer の警告が出るだけ（[voidzero-dev/vite-plus#1021](https://github.com/voidzero-dev/vite-plus/issues/1021)）
- 対処: `knip.json` の `ignoreDependencies` に `vite` を入れてある。これは「使っていないものを隠す」のではなく「knip の静的解析では見えない用途で使われている」ことを伝えるもの

- IF: knip が `vite` を未使用依存として報告した; THEN PROHIBIT: `vite` の直接依存または `ignoreDependencies` の指定を削除する
- IF: ローカルで `vp check` / `vp run -r test` / `vp run -r build` が全て通った; THEN PROHIBIT: それをもってこの種の破壊が起きていない根拠とする
  - 実際に `vite` 依存を削除しても、ローカルの検証は全て緑になった。この検証系はこの障害を検出しない

## `vp pack` の `pack.exports: true` は package.json の exports を書き換える

- 症状: `vp pack` を実行すると package.json の `exports` フィールドが自動生成で上書きされ、手書きで足したサブパス export（例: `"./tsconfig/*": "./tsconfig/*"`）が消える
- 原因: `pack` ブロックは tsdown の設定そのもので、`exports` は tsdown の機能。CLI ヘルプ上も experimental 扱い
- 対処: tsdown の `customExports` を使う。オブジェクト形式が [rolldown/tsdown#767](https://github.com/rolldown/tsdown/issues/767) / [PR #769](https://github.com/rolldown/tsdown/pull/769) で入っている

```ts
pack: { exports: { customExports: { './tsconfig/*': './tsconfig/*' } } }
```

- 上流に vite-plus 側の issue は存在しない

## vp は内部で pnpm を使っている

叩くコマンドは `vp` だけだが、実体は pnpm である。

- `vp env current` は Package Manager として pnpm（Source: `devEngines.packageManager`）を報告する
- `vp install` の出力は `Done in ... using pnpm v11.20.0` と表示する
- リポジトリには `pnpm-lock.yaml` と `pnpm-workspace.yaml` がある

したがって pnpm 固有の依存解決の挙動（前項の autoInstallPeers など）はこのリポジトリにそのまま該当する。

## `packages/utils/package.json` にプレースホルダのメタデータが残っている

- 該当箇所: `"author": "Author Name <author.name@mail.com>"`、`"repository.url": "git+https://github.com/author/library.git"`、`"homepage": "https://github.com/author/library#readme"`、`"bugs.url": "https://github.com/author/library/issues"`、`"description": "A starter for creating a TypeScript package."`
- 出自: Vite+ のテンプレートが [sxzz/tsdown-templates](https://github.com/sxzz/tsdown-templates) の default テンプレートを取り込んだもの。vite-plus の CLI スナップショットテストで期待値として固定されているため、テンプレートの未整備ではなく既知の出力
- 上流に issue はなく、公開リポジトリでもそのまま残している例が複数ある
- IF: `packages/utils` を publish する; THEN MUST: これらを実際の値に書き換える

## `vp env` は `.tool-versions` を読まない

- 症状: `.tool-versions` に node のバージョンを書いても `vp` が拾わない。`vp env current` が `Source: lts` を返す
- 原因: `vp env` の解決ソースは `.node-version` → `package.json` の `devEngines.runtime` → `package.json` の `engines.node` → `.nvmrc` の4つだけで、`.tool-versions` は含まれない
- 上流: [voidzero-dev/vite-plus#984](https://github.com/voidzero-dev/vite-plus/issues/984) が「out of scope for Vite+ at this time」でクローズされている。asdf/mise のマルチツール形式を読む予定はない。一方 `.nvmrc` は [#2207](https://github.com/voidzero-dev/vite-plus/issues/2207) で追加された
- 紛らわしい点: CI の `voidzero-dev/setup-vp` は `node-version-file` に `.tool-versions` を指定できる（[実装](https://github.com/voidzero-dev/setup-vp/blob/313600b80b104eadebb9111787d37a2e83e014ca/src/node-version-file.ts)）。CLI が読めないだけで Action は読める。`.tool-versions` に寄せると CI だけ通ってローカルが `engines.node` の range 解決に落ちる
- 対処: node のバージョンは `package.json` の `devEngines.runtime` に書く。`vp`・`setup-vp`・mise の3者が読む唯一の形式である（詳細は [EDR 0003](../../../docs/engineering-decision-logs/0003-pin-node-via-dev-engines.md)）

- IF: node 以外のツールを pin する必要が出た; THEN
  - MUST: `mise.toml` を追加してそこに書く
  - PROHIBIT: `mise.toml` に node を書く
    - node を書くと `mise.toml` が `package.json` より優先され、`vp` が見る値と mise が見る値が割れる。node を書かなければ mise は他ツールを `mise.toml` から、node を `package.json` から解決する

## catalog に寄せるときは catalog 側の値が実態と合っているか確認する

- 症状: knip の「未使用 catalog エントリ」を解消するため、ワークスペースの直書きバージョンを `catalog:` に変えたところ、`vite-plus` と `vitest` がそれぞれ `1 version, 2 instances` に分裂した
- 原因: catalog の `@types/node` が `^24` のままだったため `packages/utils` だけ 24 系に解決され、26 系に解決されるルート・`apps/website` と peer が食い違った。テンプレートがワークスペース側に `^26.1.1` を直書きしていたのは、この整合を取るためだった
- 検出方法: `vp check` / `vp run -r test` / `vp run -r build` はすべて緑のままなので、これらでは気づけない。`vp why <パッケージ名>` が `Found 1 version` を返すか、`Found 1 version, N instances` を返すかで判断する
- 対処: catalog 側の値を実態に合わせる（`^24` → `^26`）。ワークスペース側を直書きに戻すと catalog エントリが未使用になるため、catalog 側を上げるのが筋

- IF: ワークスペースの依存を `catalog:` 参照に変える; THEN MUST: 変更後に `vp why` で単一インスタンスを保っていることを確認する
