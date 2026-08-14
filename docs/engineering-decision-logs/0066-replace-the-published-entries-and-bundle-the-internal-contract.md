# 0066. 公開する入口を宣言で差し替え、内部の契約はバンドルへ畳む

## 状況

このリポジトリのパッケージは、手元では動くが公開すると動かない形をしていた。気づける経路が無い。

入口が `./src/cli.ts` と `./src/index.ts` を指している。手元でこれが動くのは、pnpm のワークスペースのリンクが実体のパスへ解決されるからで、Node が読むのは `packages/<名前>/src/*.ts` になる。公開すると同じファイルが `node_modules/@mst/<名前>/src/*.ts` に置かれ、Node は型注釈を剥がすことを拒む。`devEngines.runtime` が固定している 26.7.0 で `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` を実測した。24.19.0 でも同じである。

`private: true` の `@mst/repository-checks` を、公開できる 7 つのうち 6 つが `dependencies` で参照していた。`pnpm pack` は `workspace:*` を `0.0.0` へ置換して警告なく通る。install した側は、レジストリに無い版を引きに行って止まる。

どちらも publish するまで誰も気づかない。`vp check` も `vp run -r test` も `vp run -r build` も緑のまま通る。

## 決定

### 内部の契約はバンドルへ畳み、公開の依存に載せない

`@mst/repository-checks` を各パッケージの `devDependencies` へ移す。tsdown が external にするのは `dependencies` と `peerDependencies` なので、`devDependencies` に置いた時点でバンドルへ入る。npm に現れるパッケージは増えず、install する側から見える依存の名前も増えない。

同じ判断を `private: true` の全てに適用する。公開できるパッケージが必要とする内部の宣言は、依存として配るのではなく成果物へ畳む。

### バンドルの境界は「公開する予定があるか」で引く

`@mst/ai-native` を `devDependencies` に置いたままにすると、`@mst/ai-native/telemetry` の先にある OpenTelemetry の SDK 群まで成果物へ入った。実測では 4 つのパッケージの `dist` に `getMachineId-*.mjs` と `execAsync-*.mjs` が現れた。

公開する予定があるものは `dependencies` に置いて external にする。バンドルの対象は「公開されないもの」であって「使う側から見えないもの」ではない。

### ツールチェーン本体は peer として宣言する

`vite-plus/test` を取り込んだ成果物は Vitest 本体を抱え込んだ。`standard-io-test.mjs` が 13583 行、`lint-rule-authoring` の `index.mjs` が 3300 行になっていた。これを配ると、採用者の Vitest とインスタンスが二重になる。

`pack.external` に `vite-plus` を入れ、`peerDependencies` で受け入れる版を宣言する。実測で 22 行と 43 行になった。

### 公開する入口は宣言で差し替える

pnpm は `publishConfig` に置いた `bin` / `exports` などで、公開されるマニフェストの同名の欄を置き換える。手元の参照はソースのまま、公開されるものは成果物を指す。入口を 1 か所に寄せてどちらかを諦める必要は無い。

型を渡す `types` 条件はソースを指したままでよい。TypeScript はそれを読める。

### ソースは配らない

入口が全て成果物を指すなら、配ったソースは誰も参照しない。実際に配っていたものにはテストファイルも含まれていた。`files` の許可リストから外す。

### peer の宣言は catalog の検査から外す

[EDR 0041](0041-let-the-declaration-decide-the-release.md) は「ピア依存は範囲を広く取るのが設計上正しく、単一のリリースに寄せる対象ではない」と決めている。一方で [EDR 0028](0028-keep-the-catalog-for-shared-versions-only.md) が入れた依存宣言の検査は `peerDependencies` も読んでいて、`^0.2.8` が catalog の `0.2.8` と食い違うという警告を出した。

範囲で書くのが正しい宣言に警告を出す検査は、書き手に catalog へ寄せる動機を与える。検査が読む欄から `peerDependencies` を外す。

### 出荷できる形を機械が見る

`dont-review-it check` に検査を足す。見るのはマニフェストの宣言だけで、成果物が実在するかは見ない。実在を条件にすると、ビルド前の実行で報告が変わる検査になる。

## 帰結

- 受け入れの確認は、pnpm で tarball を install して `bin` を起動し、採用者側の Vitest から公開したヘルパを使うところまでで取る。手でディレクトリへ展開する形は、依存が平らに並ぶため宣言の抜けを隠す
- `publishConfig` による欄の置き換えは pnpm の機能である。`npm publish` を直接使うと置き換えが起きず、入口がソースを指したまま公開される
- 公開されるマニフェストの `devDependencies` には `private: true` のワークスペースが残る。install する側はこの欄を読まないので届かない
- 成果物に含めるものが減り、`@mst/dont-review-it` の tarball は成果物・skill・tsconfig だけになった
- `@mst/ai-native` と `@opentelemetry/api` は、畳んだ契約の中からだけ参照される。ソースには現れないので knip の `--production` が未使用として報告し、`ignoreDependencies` へ登録した。素の knip は同じ登録を「外せ」と助言する。両方の走らせ方で過不足の無い設定は書けないため、助言の側を採らない
