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

## catalog に寄せるときは catalog 側の値が実態と合っているか確認する

- 症状: knip の「未使用 catalog エントリ」を解消するため、ワークスペースの直書きバージョンを `catalog:` に変えたところ、`vite-plus` と `vitest` がそれぞれ `1 version, 2 instances` に分裂した
- 原因: catalog の `@types/node` が `^24` のままだったため `packages/utils` だけ 24 系に解決され、26 系に解決されるルート・`apps/website` と peer が食い違った。テンプレートがワークスペース側に `^26.1.1` を直書きしていたのは、この整合を取るためだった
- 検出方法: `vp check` / `vp run -r test` / `vp run -r build` はすべて緑のままなので、これらでは気づけない。`vp why <パッケージ名>` が `Found 1 version` を返すか、`Found 1 version, N instances` を返すかで判断する
- 対処: catalog 側の値を実態に合わせる（`^24` → `^26`）。ワークスペース側を直書きに戻すと catalog エントリが未使用になるため、catalog 側を上げるのが筋

- IF: ワークスペースの依存を `catalog:` 参照に変える; THEN MUST: 変更後に `vp why` で単一インスタンスを保っていることを確認する

## `lint.plugins` を書くと既定のプラグインが消える

- 症状: vitest プラグインを有効にしたくて `lint.plugins: ["vitest"]` と書いたところ、`unicorn` / `typescript` / `oxc` の 53 ルールが無効になった。`vp check` は緑のままなので気づけない
- 原因: `plugins` は追加ではなく置換である。oxlint の型定義にも「Setting the `plugins` field will overwrite the base set of plugins」と書かれている。既定は `["unicorn", "typescript", "oxc"]`
- 検出方法: `vp lint --print-config` が解決後の `plugins` と全ルールを吐く。設定変更の前後で取って diff を取ると、消えたルールが行として見える
- 対処: 既定を明示して足す（`["unicorn", "typescript", "oxc", "vitest"]`）

- IF: `lint.plugins` を触る; THEN MUST: 変更前後で `vp lint --print-config` を diff し、差分が追加だけであることを確認する

## `vitest/consistent-test-filename` の `pattern` は素直に書くと壊れる

テストの配置規約（対象ソースと同じディレクトリに `<ソース名>.test.ts`）は、ルートの `vite.config.ts` でこのルールを使って強制している。実装は [oxc の consistent_test_filename.rs](https://github.com/oxc-project/oxc/blob/367f730a7b578d24e8106713abaf517304b6b655/crates/oxc_linter/src/rules/vitest/consistent_test_filename.rs) にあり、設定を書くときに引っかかる仕様が3つある。

- **`pattern` を `/` で始めると正規表現リテラルとして解釈され、黙って別物になる**
  - 症状: `pattern: "/src/.*\\.test\\.tsx?$"` と書いたら、診断の help に出るパターンが `src` だけになり、パスに `src` を含むファイルが何でも通るようになった。エラーにはならないので気づけない
  - 原因: `compile_matcher_pattern` が「`/` 始まりなら `/pattern/flags` 形式」とみなし、`strip_prefix('/')` した文字列の**最後の `/`** で切る。`src/.*\.test\.tsx?$` の最後の `/` は `src` の直後なので、パターンが `src`、フラグが `/.*\.test\.tsx?$` に割れる
  - 対処: `/` で始めない。パス区切りを先頭に置きたいときは `[/]` と書く
- **マッチ対象は絶対パス全体**
  - `ctx.file_path()` をそのまま `is_match` にかける。`^packages/` のようなリポジトリルート起点のアンカーは一致しない（`^/Users/` は一致する）
  - 裏返しとして、チェックアウト先のパスに `tests/` のような文字列が含まれるとパス判定が意図せず動く可能性がある
- **先読みが使えない**
  - `lazy_regex`（Rust の `regex` crate）なので `(?!...)` が書けない。「`tests` セグメントを含まない」を `pattern` 単体では表現できない
  - そのため設定は2段構えにしている。ベースの `rules` で命名（`\.test\.tsx?$`）だけを見て `.spec.ts` を弾き、`overrides` の glob でテスト用ディレクトリを捕まえて到達不能な `pattern` を与えて必ず error にする
  - `overrides` 側の `pattern` に置いた `place-the-test-file-next-to-its-source-instead-of-a-test-directory` は、正規表現として意味を持たせるためではなく、help 行が `Rename the file that match the pattern (?u)place-the-test-file-next-to-its-source-instead-of-a-test-directory` と読めて直し方が伝わるようにするための文字列

- IF: `vitest/consistent-test-filename` の `pattern` を変更する; THEN MUST: 変更後に違反ファイルを実際に置いて error になることを確認する
  - このルールは条件に合わなければ黙って何も言わない。設定ミスは「lint が緑」として現れるため、正のケースだけでは検出できない
