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

テストは CI だけで実行する。ローカルで同じ範囲を確認できるよう、`vp run ready` は CI と同じ4つを実行する。

## 影響

push は静的検査の時間だけで完了する。テストの失敗は CI でのみ検出されるため、main に push した後に気づく可能性がある。

フックは Vite+ の仕組みに乗る。`vp config`（`package.json` の `prepare` から毎回実行される）が `.vite-hooks/_` にディスパッチャを生成し、`core.hooksPath` をそこに向ける。リポジトリが所有するのは `.vite-hooks/` 直下のフックスクリプトで、`_/` 配下は生成物。ディスパッチャは `node_modules/.bin` を PATH の先頭に置くため、フックはグローバルの vp ではなくプロジェクトローカルの vp を使う。

CI は `vp install` に `--frozen-lockfile` を渡す。これがないと、`package.json` だけ更新して lockfile を更新し忘れた変更が来たときに、CI が黙って lockfile を書き換えて緑になる。

## 依存更新

Mend-hosted Renovate App を使う。self-hosted の workflow は使わない。

self-host が必要になるのは依存グラフが Mend 側の 3GiB メモリ上限を超えて完走できない規模のときで、mst にはその事情がない。Mend-hosted では `postUpgradeTasks` が使えないが、lockfile の更新は Renovate 本体が行い、そのとき使う pnpm のバージョンは `devEngines.packageManager` を尊重する。

設定ファイルを置くだけでは動かない。GitHub 側で masseater/mst に Renovate App を許可する操作が別途必要になる。

### Vite+ 構成で Renovate に効かせるために必要なこと

素朴に書くと効かない箇所が3つある。いずれも設定は通る（validator も成功する）が、実行時に何も起きない。

**catalog の npm エイリアスは `packageName` でしか当たらない。** `vite: npm:@voidzero-dev/vite-plus-core@0.2.8` を Renovate は `depName: "vite"` / `packageName: "@voidzero-dev/vite-plus-core"` として抽出し、`matchPackageNames` は `packageName` だけを見る。catalog のキーである `vite` を書いても死んだエントリになる。

**`vite-plus` と このエイリアスは同一版を数秒差で publish される別パッケージとして見える。** グルーピングは「どこに出るか」を決めるだけで、「いつ eligible になるか」はパッケージ単位で評価される。メンバー間で `minimumReleaseAge` や `schedule` が割れると、grouped PR が eligible なメンバーだけで出て、リリースされたことのない組み合わせが main に入る。上流が [voidzero-dev/vite-plus#2356](https://github.com/voidzero-dev/vite-plus/issues/2356) で報告しており、voidzero-dev/setup-vp で実際に起きて修正されている。そのためグループ側で両方を明示している。

**`devEngines.packageManager` を Renovate は依存として抽出しない。** lockfile 更新時に使う pnpm を決める用途では読むが、更新対象にはならない（[renovatebot/renovate#38067](https://github.com/renovatebot/renovate/issues/38067) が OPEN）。`matchPackageNames: ["pnpm"]` のルールは、jsonata の customManager を足して初めて発火する。

CI 側も同様で、`voidzero-dev/setup-vp` は `actions/setup-*` でも Renovate の community actions リストにも含まれないため、`node-version` をワークフローに直書きすると Renovate の管理外になる。`.node-version` を置いて `node-version-file` で参照すれば nodenv manager が管理する。

なお setup-vp が使う Vite+ のバージョンは、`version` / `version-file` を書かなければ `package.json` の `vite-plus` エントリ（`catalog:` なら catalog 経由）を自動解決する。明示しない方がバージョンの出所が1箇所に保たれる。

## 未使用検出

knip を使う。検出された指摘を `ignoreDependencies` や `exclude` で黙らせない。

指摘が正しいなら実体を直す。実例として、catalog にエントリがあるのに `typescript` をワークスペース側で直書きしていた件は、`catalog:` 参照に統一して解消した。`bumpp` はリリース用ツールでありながらどの script からも呼ばれていなかったため、`release` script を足して実際に使う形にした。

ただし catalog に寄せるときは catalog 側の値が実態と合っているかを確認する必要がある。`@types/node` を `catalog:` に変えた際、catalog の値が `^24` のままだったため `packages/utils` だけ 24 系に解決され、26 系のルート・website と peer が食い違って `vite-plus` と `vitest` のサブグラフが2系統に分裂した。テンプレートがワークスペース側に `^26.1.1` を直書きしていたのは、この整合を取るためだった。catalog を `^26` に上げて解消している。

依存グラフが分裂しても `vp check` / `vp run -r test` / `vp run -r build` はすべて緑になる。`vp why <pkg>` が `Found 1 version` を返すかどうかで確認する。

ignore が許されるのは「使っているがツールの静的解析からは見えない」場合に限る。`vite` がこれに当たり、ソースからは参照されないが依存グラフの分裂を防ぐために必要なため `ignoreDependencies` に入れている（詳細は [0001](0001-adopt-vite-plus-as-the-toolchain.md)）。
