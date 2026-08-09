# 0001. ツールチェーンに Vite+ を採用する

- ステータス: Accepted
- 日付: 2026-08-09

## 文脈

mst は、リポジトリ運用の仕組みを再利用可能な単位として整備していく先として立ち上げる。

pnpm + turbo + oxlint + eslint + vitest を個別に組み合わせる構成では、設定ファイルがワークスペースごとに分散する。mst は新規リポジトリであり、この構成を引き継ぐ必然性はない。

## 決定

Vite+（vite-plus）を唯一のツールチェーンとして採用する。

- グローバル CLI の `vp` は公式インストーラ（`curl -fsSL https://vite.plus | bash`）で導入する
- リポジトリの土台は `vp create vite:monorepo` の生成物をそのまま使う
- 設定は `vite.config.ts` に集約し、ツールごとの個別設定ファイル（`oxlint.config.ts` / `.oxfmtrc.json` / `vitest.config.ts` など）を作らない
- 依存バージョンは `pnpm-workspace.yaml` の catalog に集約する

## 影響

bundler・test runner・linter・formatter・タスクランナー・パッケージマネージャ・Node ランタイムが `vp` ひとつの下にまとまる。Node や pnpm を個別に管理する必要がなくなり、リポジトリに mise などのバージョン管理設定を置かない。

vp は内部で pnpm を使う。`vp env current` は Package Manager として pnpm を報告し、リポジトリには `pnpm-lock.yaml` と `pnpm-workspace.yaml` がある。したがって pnpm 固有の依存解決の挙動はこのリポジトリにそのまま該当する。

Vite+ は beta（0.2.x）であり、破壊的変更と数日単位のリリースを前提に運用する必要がある。

## 検討して採らなかった案

**npm パッケージ版の vp をバージョンマネージャ経由で導入する。** `vp test` がプロジェクトローカルの `vite-plus` と vitest インスタンスを二重に持ち、`Vitest failed to find the current suite` で必ず失敗する。同一バージョン同士でも発生し、`vp check` は通るため気づきにくい。上流も npm でのグローバルインストールはサポート対象外と明言している（[voidzero-dev/vite-plus#2097](https://github.com/voidzero-dev/vite-plus/issues/2097)）。

**pnpm + turbo + oxlint + eslint + vitest を個別に組み合わせる構成をそのまま持ち込む。** 新規リポジトリで引き継ぐ必然性がなく、設定がワークスペースごとに分散するという課題をそのまま引き受けることになる。

## 生成物の扱い

スキャフォールドの生成物は独自設計に置き換えない。生成物のまま問題が出たときは、まず上流の issue を調べる。

テンプレートが入れる一見不要な依存に、依存解決上の理由があることがある。実例として、ルートと `packages/utils` の `vite` 直接依存を未使用と判断して削除したが、これは pnpm での vite/vitest 二重インスタンス化を防ぐために入れられたものだった（[voidzero-dev/vite-plus#1932](https://github.com/voidzero-dev/vite-plus/issues/1932)）。pnpm では `overrides` が実際の依存エッジを持つワークスペースにしか効かず、直接依存のないワークスペースでは autoInstallPeers が上流の素の vite を別途インストールする。

ローカルで `vp check` / `vp run -r test` / `vp run -r build` がすべて緑になることは、この種の潜在的な破壊を検出しない。実際、削除した状態でもすべて緑だった。
