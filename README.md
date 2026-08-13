# mst

リポジトリ運用の仕組みを、再利用可能な単位で整備していくためのリポジトリ。

## Overview

mst は、リポジトリ運用の仕組み（開発フロー、チェック体系、エージェント向けの文脈整備など）を、他のプロジェクトでも使える単位に切り出して整備していく先です。

現時点では Vite+ による monorepo の土台が立ったところで、仕組みの整備そのものはこれからです。どのワークスペースがあるかは [docs/workspaces.md](./docs/workspaces.md) を参照してください（`pnpm-workspace.yaml` から生成されます）。

詳細な構成・アーキテクチャ・開発上の注意事項は `AGENTS.md` を参照してください。

## Installation

グローバル CLI の `vp` を公式インストーラで導入します。

```bash
curl -fsSL https://vite.plus | bash
```

Windows の場合:

```powershell
irm https://vite.plus/ps1 | iex
```

続いて依存をインストールします。

```bash
vp install
```

> [!IMPORTANT]
>
> `vp` を npm 経由（`npm i -g vite-plus`、mise の `npm:vite-plus` など）でグローバル導入すると、`vp test` が二重インスタンスになって失敗します。必ず上記の公式インストーラを使ってください。上流でも [voidzero-dev/vite-plus#2097](https://github.com/voidzero-dev/vite-plus/issues/2097) で、npm でのグローバルインストールはサポート対象外だと明言されています。

## Project Dependencies

ツールチェーンは Vite+（vite-plus）に一本化しています。構成は 2 部に分かれます。

- `vp` — グローバルにインストールする CLI
- `vite-plus` — プロジェクトローカルの devDependency

`vp` が Node.js と pnpm を自前で管理するため、Node や pnpm を個別にインストールする必要はありません。

## Development Commands

開発コマンドの一覧は [AGENTS.md](./AGENTS.md) にあります。

## License

非公開リポジトリのため未設定です。

## Related Links

- [Vite+ ガイド](https://viteplus.dev/guide)
