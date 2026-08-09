# 0002. 品質ゲートをコミット・push・CI に配置する

- ステータス: Accepted
- 日付: 2026-08-09

## 文脈

コミット・push・CI のどこで何を検査するかを決める必要がある。手元の検査が重いと開発の手が止まり、軽すぎると壊れたものが main に入る。

## 決定

検査を3段に分ける。

- **pre-commit** — staged ファイルに対して `vp check --fix`。format・lint・型検査と自動修正
- **pre-push** — リポジトリ全体に `vp check`。テストは含めない
- **CI** — `vp check` → `vp run -r test` → `vp run -r build` → `vp run knip`

テストは CI だけで実行する。

## 影響

push は静的検査の時間だけで完了する。テストの失敗は CI でのみ検出されるため、main に push した後に気づく可能性がある。未使用の依存・export・ファイルの検出（knip）も CI でのみ実行される。

フックは Vite+ の仕組みに乗る。`vp config`（`package.json` の `prepare` から毎回実行される）が `.vite-hooks/_` にディスパッチャを生成し、`core.hooksPath` をそこに向ける。リポジトリが所有するのは `.vite-hooks/` 直下のフックスクリプトで、`_/` 配下は生成物。ディスパッチャは `node_modules/.bin` を PATH の先頭に置くため、フックはグローバルの vp ではなくプロジェクトローカルの vp を使う。

## 依存更新

Mend-hosted Renovate App を使う。self-hosted の workflow は使わない。

self-host が必要になるのは依存グラフが Mend 側の 3GiB メモリ上限を超えて完走できない規模のときで、mst にはその事情がない。Mend-hosted では `postUpgradeTasks` が使えないが、lockfile の更新は Renovate 本体が行う。

設定ファイルを置くだけでは動かない。GitHub 側で masseater/mst に Renovate App を許可する操作が別途必要になる。

## 未使用検出

knip を使う。検出された指摘を `ignoreDependencies` や `exclude` で黙らせない。

指摘が正しいなら実体を直す。実例として、catalog にエントリがあるのに各ワークスペースがバージョンを直書きしていた `typescript` と `@types/node` は、`catalog:` 参照に統一することで解消した。

ignore が許されるのは「使っているがツールの静的解析からは見えない」場合に限る。`vite` がこれに当たり、ソースからは参照されないが依存グラフの分裂を防ぐために必要なため `ignoreDependencies` に入れている（詳細は [0001](0001-adopt-vite-plus-as-the-toolchain.md)）。
