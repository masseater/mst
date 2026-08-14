# 0064. ゲートの実行を 1 本のトレースにし、エージェント自身に読ませる

## 状況

`vp run guard` が遅い。どこが遅いかを答える手段は、`spool` が要約行へ書く所要時間だけだった。これは包んだコマンド 1 件の合計であり、その内側の内訳を持たない。

手元の記録から読める姿は、`vp check` が 189.2 秒、`ai-native` のテストが 2 分 17 秒、`dont-review-it` のテストが 1 分 40 秒、`vp run: 0/39 cache hit (0%)` だった。支配しているのは 2 つに絞れたが、どちらも「その内側の何が」に答えられない。

[EDR 0021](0021-measure-our-own-lint-rules-and-let-the-user-choose-the-sink.md) が lint ルールの計測を入れているが、信号がメトリクス 1 本なので、1 回の実行の中で何が何の内側で起きたかを復元できない。

## 決定

ゲートが動かすもの全体を 1 本のトレースにする。信号は traces・metrics・logs の 3 つを使う。受け皿は EDR 0021 が置いた手元の grafana-lgtm をそのまま使い、エージェントが MCP 経由で問い合わせられるようにする。

### 計測は時間を使っている当人に置き、呼び出し側で包まない

ゲートの各ステップを計測用のラッパーで包む形を検討し、捨てた。包む形は、包み忘れた経路が計測から静かに漏れる。漏れたことは計測結果からは読めないため、「そのステップは速い」と「そのステップは測っていない」が同じ見た目になる。

代わりに、時間を使っている当人が自分を計測する。lint は oxlint の JS プラグインの中で、テストは Vitest の中で、このリポジトリの検査 CLI は検査の契約の中で、`spool` は包んだ子プロセスについて、それぞれ自分の所要時間を出す。ステップを列挙する場所はどこにも無い。

Vite Task の側に差し込む形も検討し、現時点では取れないことを確かめた。task runner の reporter は Rust の内部の trait であり、JS へ露出していない。`run` の設定にフックは無く、唯一のライフサイクル機構は `preX`/`postX` スクリプトである。プラグインから足す道も [vite-plus#1211](https://github.com/voidzero-dev/vite-plus/issues/1211) が塞いでいて、`config` フックが定義したタスクを `vp run` は黙って無視する。この issue が解決したら、包まずに全ステップを覆う形を再検討する。

### プロセスをまたぐ文脈は環境変数で運ぶ

ゲートは入れ子のプロセスの木である。木を 1 本のトレースにするには、親の文脈が子へ届く必要がある。

[Environment Variables as Context Propagation Carriers](https://opentelemetry.io/docs/specs/otel/context/env-carriers/) が 2026-07-01 に Release Candidate になっており、`@opentelemetry/propagator-env-carrier` が実装を出している。Vitest も同じ仕様で `TRACEPARENT` を読む。自前で環境変数を組み立てない。

`spool` は子プロセスを起こすとき、この経路で文脈を渡す。

### 1 プロセスに 1 つの service.name を持たせる

計測の入口はプロセスごとに複数ある。lint の計測を持つモジュールと検査の契約が同じプロセスに同居することがある。

provider の組み立ては 1 プロセスで 1 回だけ行い、最初に計測を求めた入口が `service.name` を決める。プロセスの中で 2 つ目の provider を作らない。2 つあると、どちらが送ったかで resource が変わり、同じプロセスの中の span が別のサービスとして並ぶ。

### 送信は他の全ての片付けが済んでから始める

計測を求める入口が複数あると、後から登録した片付けが provider の停止に間に合わない。`beforeExit` の同じ回で登録順に走るため、先に登録された停止処理が後の片付けを追い越す。

停止は `beforeExit` の中で直接始めず、マイクロタスクへ回す。`beforeExit` の全ての listener が同期的に走り終えてからマイクロタスクが流れるので、登録順に関わらず、片付けが済んだ後で送信が始まる。

### SDK は個別の provider を組み、`NodeSDK` を使わない

`NodeSDK` は 3 つの信号をまとめて立ち上げるが、gRPC の exporter と Prometheus の exporter を静的に import している。HTTP/JSON しか使わなくても依存木が全部ぶら下がる。実測で、個別に組んだ場合はインストールされるパッケージが 15 個・29MB・import 49ms、`NodeSDK` を使った場合は 71 個・49MB・import 72ms だった。起動の速さが体感に直結する CLI で、この差を払う理由が無い。

`NodeSDK.shutdown()` は 3 つの provider の `shutdown()` を並べて待つだけなので、同じものは自分で書ける。

### 有効化の合図はリポジトリ全体で 1 つにする

EDR 0021 が用意した `MST_LINT_RULE_DURATION` を `MST_TELEMETRY` に置き換える。用途ごとに合図を増やすと、どこが遅いかを知りたい人が、測りたい対象の数だけ環境変数を並べることになる。合図は 1 つで、送信先は標準の `OTEL_EXPORTER_OTLP_ENDPOINT`、停止は標準の `OTEL_SDK_DISABLED` のままにする。

### Events は Logs の一部として出す

OpenTelemetry の Events API と SDK は削除されている。[opentelemetry-js#5721](https://github.com/open-telemetry/opentelemetry-js/issues/5721) が 2025-06-11 に閉じられ、仕様が logs と events を区別しなくなった。npm 上の `@opentelemetry/api-events` は現行のリリース列に乗っていない。

出来事は LogRecord の `eventName` として出す。`spool` が記録したコマンドの出力は、この形で本文とともに送る。

### 読む側は MCP で問い合わせる

計測した結果を人間が Grafana の画面で読むだけなら、エージェントは自分が入れた変更の効果を確かめられない。`.mcp.json` に Grafana の MCP サーバーを置き、metrics と logs を Grafana 経由で、traces を Tempo が内蔵する MCP 経由で引けるようにする。

Tempo の MCP は既定で無効なので `compose.yaml` の環境変数で有効にする。Grafana のデータソースプロキシを通るため、Tempo のポートを公開する必要は無い。otel-lgtm は匿名で Admin を与える設定を既定で持つので、資格情報は要らない。`.mcp.json` に秘密が入らないため、そのまま版管理に入れられる。

公開するツールは絞る。既定の 72 個はエージェントの context を圧迫し（[mcp-grafana#569](https://github.com/grafana/mcp-grafana/issues/569)）、alerting のツールはスキーマに真偽値の部分スキーマを含むため Claude 側のツール登録が失敗して全ツールが無言で消える（[mcp-grafana#1054](https://github.com/grafana/mcp-grafana/issues/1054)）。

## 帰結

- `@opentelemetry/sdk-trace-base` は 2.10.0 時点で中身がシムだけになっており、実体は `@opentelemetry/sdk-trace` にある。後者の span processor は位置引数ではなくオブジェクト引数を取る。位置引数で書くと型検査も lint も通り、停止時に例外が出て、送信が 1 件も行われないまま終わる
- 公開ツールを絞った結果、MCP が出すツールは 22 個になった
- Vitest 4.1.10 は `experimental.openTelemetry` を持っており、テストの内訳は自前の reporter を書かずに取れる。`sdkPath` は Vitest の `root` からの相対で解決されるため、ワークスペースごとに `root` が変わるこのリポジトリでは絶対パスを渡す必要がある
- 実測で、テストの所要時間を支配しているのは `vitest.worker.start` だった。`isolate: true` がテストファイルごとにフォークを立て直す費用であり、カバレッジの費用ではない
- 計測を有効にしたまま受け皿を止めていると、包んだコマンドは失敗する。EDR 0021 の判断をそのまま引き継ぐ
- `spool` が包む対象は、この決定によって計測の対象でもある。`@mst/ai-native` は資源を守る道具に加えて、計測の立ち上げを持つ
- Vite Task は環境変数をキャッシュのフィンガープリントに数える。文脈を運ぶ環境変数は実行ごとに変わるため、計測を有効にした実行はタスクのキャッシュに当たらない。計測は既定で無効なので、通常の実行には影響しない
