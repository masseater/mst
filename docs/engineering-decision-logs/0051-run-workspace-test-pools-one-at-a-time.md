# 0051. ワークスペースのテスト用 worker pool は一つずつ実行する

- ステータス: Accepted
- 日付: 2026-08-13

## 文脈

各 workspace の `scripts.test` は Vitest を起動する。Vitest の既定 `forks` pool は利用可能な CPU 数から worker 数を決め、テストファイルを子 process へ分配する。Vite Task の recursive 実行も別の層で workspace task を最大 4 本まで同時に起動するため、両方を既定のまま重ねると、各 Vitest がホスト全体を前提に選んだ worker 数が workspace の本数だけ増える。

12 CPU のホストでは、一つの Vitest が最大 11 forks を起動した。3 workspace の coverage が重なった実行では、二つの package が各 11 forks、もう一つが 1 worker を使い、別の子 process も起動した。Vitest が持つ worker 起動応答の 60 秒以内に 11 workers が応答できず、一つの workspace の失敗で recursive task が終了した後も、並行していた二つの Vitest process tree が残った。

test case の `testTimeout` は worker 起動前の期限へ作用しない。workspace を一つずつ実行すると全 package の coverage は成功したが、完全な `guard` では 276 test files を持つ一つの package が 11 forks を起動した段階で同じ起動期限を超えた。4 workers に減らした競合下の実行でも最後の 2 workers が期限を超えた一方、2 workers では 276 files と 5513 tests、全 source の coverage を完走した。workspace 間の乗算を除くだけでは、package 内の起動 burst をホストが常に処理できる保証にならない。

`maxWorkers` が上限にするのは Vitest の test-file worker だけであり、各 worker がさらに起動する `vp lint` や Node fixture はその数に含まれない。実 process の起動と終了を deadline で検証する package では、package 内の file 並列性も無効にする。

全 workspace の `fileParallelism` を無効にすると二重並列は消えるが、数百 test files を持つ package 内の有効な並列性まで失い、`guard` 全体の 1800 秒上限を圧迫する。`threads` pool は process 全体の状態を扱うテストと native addon を使うテストの分離境界を変えるため、forks の代替にはしない。

## 決定

`guard:all` の recursive test 段だけを `vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2` とする。Vite Task が持つ workspace の依存順を保ち、同時に起動する Vitest を一つに限定する。各 Vitest は既定の forks pool を使い、最大 worker 数を 2 に制限する。`ai-native`、`auto-develop`、`dont-review-it`、`stop-ai-slop` は実 process を扱う test files を持つため、各 package の `vite.config.ts` で `fileParallelism: false` を宣言する。Vitest はこの指定を root の `--maxWorkers 2` より優先し、その package の worker 数を 1 にする。

CI の `ready` job は 40 分を外側の上限とする。`guard` 自身の 1800 秒と終了猶予に加え、checkout、Vite+ の導入、依存の取得、job の終了処理を包含し、CI が `guard` 自身の打ち切りより先に終了しない値である。

同じホストで先行する `guard` を待つ予算も、逐次化後の所要と command の打ち切りを包含する値へ同期する（[EDR 0034](0034-borrow-the-lock-and-measure-the-clocks-on-this-repository.md)）。

root の呼び出し形と転送引数は [EDR 0052](0052-inspect-the-root-test-invocation-that-forwards-runner-arguments.md) の静的検査で固定する。

build と skill 検証は既定の task 並列性を保つ。独立した成果物を作る処理まで逐次化せず、worker pool を内包する test task にだけ上限を置く。

package の `scripts.test` は、単独実行でも recursive 実行でも同じ自動発見設定と coverage source universe を読む契約を維持する（[EDR 0047](0047-make-the-coverage-source-universe-explicit.md)）。workspace の逐次化は root の実行順だけを決め、root からは coverage の有効化と worker 上限だけを追加する。自動発見する config、test files、coverage source universe は上書きしない。

## 影響

- 同時 Vitest 数は 1、同時 worker 数は最大 2 となり、worker 数の上限が workspace 数やホストの論理 CPU 数との積にならない。
- 一つの workspace が失敗した時点では、他 workspace の Vitest process tree はまだ起動していない。recursive task の中断で並行 package が孤児化する経路を作らない。
- package 内には原則として最大 2 files の並列性を残す。`ai-native`、`auto-develop`、`dont-review-it`、`stop-ai-slop` は 1 file ずつ実行し、test worker が起動する実 process を同一 package 内で競合させない。
- workspace が増えても同時 worker 数は増えない一方、coverage の所要時間は各 package の和になる。`guard` の 1800 秒上限を超える場合は、各 test の責務と実 process 境界を減らして解消し、二重並列を戻さない。
- Vite Task の既定並列数や Vitest の worker 既定が変わっても、root guard の workspace 上限は 1、worker 上限は 2 のままになる。
