# 0053. ダブルの隔離は各テスト設定に宣言させ、要求する値はルールが持つ

- ステータス: Accepted
- 日付: 2026-08-13

## 文脈

ダブルの扱いを縛るルール群は、テストごとに呼び出し記録と実装が戻ることを前提に書かれている。`no-vi-mock-factory-behavior--use-spy-true-and-fixture` の文書は「器は読み込み時に一度だけ作られるが、共有設定が各テストの前に呼び出し記録と実装をクリアするので、テスト間に持ち越される状態を持たない」と、その前提を自分で宣言している。`no-redundant-mock-reset--lift-mocks-into-fixture` が個別のリセット呼び出しを禁じているのも、共有設定が同じことをしている前提に立っている。

その共有設定はどこにも入っていなかった。ルートにも 8 つのワークスペースにも `test` ブロックはあるが、中身はカバレッジの閾値と並列度だけである。前提を欠いたままルールだけが動いていた。

欠けていることはテストの結果に現れない。実装を差し替えるテストの次に元の実装を読むテストを置いて実測したところ、パッケージ単位の実行では差し替えたままの値が返った。全部緑のまま、隣が残した状態の上でテストが通っていた。

## 決定

**`no-shared-double-state--reset-doubles-between-tests` を足し、`vite.config.*` と `vitest.config.*` の `test` ブロックに `mockReset: true` と `restoreMocks: true` を宣言させる。** 判定はファイル 1 枚で閉じ、真偽値のリテラルだけを宣言として数える。`test` ブロックを持たない設定も報告する。

要求する値はルールが持ち、設定ファイル側は要求を満たしていることだけを書く。値を変えるときはルールを変え、全設定ファイルが一斉に赤くなる。

この形は [0017](0017-demand-full-coverage-in-every-test-config.md) がカバレッジの下限について採ったものと同じである。0017 は「ルートの `test` ブロックはワークスペースの実行に効かない」ことを実測したうえで、対象になり得る設定ファイルすべてにルールを発火させると決めている。同じ制約が同じ形の答えを要求する。

## 検討して採らなかった案

**preset の関数から配る（`dontReviewItPreset.test`）。** [0047](0047-hand-every-toolchain-block-one-preset-function.md) が `fmt` と `lint` について採った形をそのまま `test` にも広げる案で、最初に実装した。配るには利用側が `@mst/dont-review-it` をワークスペース依存に持つ必要があり、そこでタスクグラフが 2 方向に循環する。実測した循環は次の 2 つである。

```
@mst/dont-review-it#test -> @mst/lint-rule-authoring#test -> @mst/dont-review-it#test
@mst/ai-native#test      -> @mst/dont-review-it#test      -> @mst/ai-native#test
```

`dont-review-it` は `lint-rule-authoring` / `repository-checks` / `verified-specifications` を実行時依存に持ち、自身の test script を `spool` で包むために `ai-native` を devDependency に持つ。この直接辺だけで上の 2 循環が成立するため、`dont-review-it` は少なくとも `ai-native` と `lint-rule-authoring` という自分の依存先へ設定を配れず、全 workspace をこの形へ統一できない。pnpm の install は通り、詰まるのはタスクの計画だけである。

これは上流の欠陥である。vite-task は `dependencies` / `devDependencies` / `peerDependencies` のすべてを実行順序の辺として扱い、循環を hard-error にする（[vite-task#411](https://github.com/voidzero-dev/vite-task/issues/411)）。pnpm と turbo は同じワークスペースを問題なく扱う。修正は [vite-task#414](https://github.com/voidzero-dev/vite-task/pull/414) にあるが、2026-08-13 時点で未マージであり、リポジトリが使う vite-plus 0.2.8 には入っていない。

[0042](0042-apply-one-preset-at-the-root-and-report-the-exception-the-toolchain-forces.md) は同じ欠陥に対して「上流に修正がある一時的な欠陥を避けるために、パッケージの構成を恒久的に組み替えない」と決めており、fixture 専用パッケージの新設も既存パッケージへの移設も検討して捨てている。**隔離設定のためにワークスペース依存を持たない葉のパッケージを立てる案は、その決定が既に捨てた形と同じものなので採らない。**

**タスクの前後関係を設定で切る。** ルートの `run.tasks` に `test` を定義しても、各パッケージの package.json の同名スクリプトがあるため効かない（Vite+ は同名のタスクを両方に定義することを禁じている）。パッケージ側の `vite.config.ts` に置くとタスクグラフの読み込み自体が落ちる。循環は宣言した `dependsOn` ではなくパッケージグラフから導かれているので、設定で外せる場所が無い。

**ルートに 1 回だけ書く。** 0017 が実測で否定している。パッケージのディレクトリで走らせるとルートの `test` ブロックは効かない。

## 影響

ルートと 8 ワークスペースの 9 つの設定ファイルが `mockReset: true` と `restoreMocks: true` を宣言する。同じ 2 行が 9 箇所に並ぶが、書き写しの危険は 0017 と同じ形で閉じている。値はルールが持ち、設定ファイル側で下げることはできない。

隔離が実際に効くことは、実装を差し替えるテストの次に元の実装を読むテストを置いて確かめた。宣言前はパッケージ単位の実行で差し替えたままの値が返り、宣言後は元の実装が返る。

**414 が入ったら、この決定は 0047 の形へ畳める。** `dontReviewItPreset.test` が隔離を返し、このルールは `no-unwrapped-toolchain-config--call-the-preset-for-the-block` の `test` ブロック版に置き換わる。そのときの作業は、preset に関数を 1 つ足し、9 つの設定を包み、ルールを 1 本消すことである。
