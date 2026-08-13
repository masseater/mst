# 0006. 導出結果のキャッシュに抽出ロジックの版を持たせる

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

有限値の語彙の catalog は生成物を commit せず、lint process が repository source から導出する。注釈を編集した後に人が更新 command を実行する手順を作ると、更新忘れによって古い catalog が正規情報として残るためである。

lint のたびに Oxc parser と TypeScript checker で全 owner を解決すると、同じ repository を読む各 rule process が同じ費用を繰り返す。そこで lint は導出結果を disk cache に置く。ただし source の内容だけでは、抽出ロジックや entry shape が変わったことを表せない。実装変更前の entry が新しい owner 契約を満たすものとして読まれると、不正な値・path・range・route が lint の判定と免除へ入る。

## 決定

lint 用 catalog cache は形式の version を持ち、抽出の解釈または entry shape を変えた変更で version を上げる。現在の `CACHE_FORMAT_VERSION` は 5 である。

version は 2 箇所で照合する。

- input fingerprint を作る hash に version を最初に加える
- cache payload の `version` が現在値と完全一致することを読み出し条件にする

fingerprint の file input は、`commentSources` と `declarationSources` から独立した `cacheInputs` である。repository 内の JavaScript・TypeScript source と declaration、JSON、package manifest、TypeScript config、dependency graph を決める workspace config と lockfile を含める。test・Story・fixture、`.d.ts`、`dist` の生成 source は owner 候補にならなくても checker が production owner の import や package entry から参照できるため、cache input からは外さない。`.git`・`.cache`・`coverage`・`node_modules` は走査せず、repository 外 dependency の内容は manifest・config・lockfile の変更で invalidation する。

走査で検出した problem の kind・path・line も input fingerprint に含める。repository 外へ出る symbolic link の追加や除去は、走査対象 file の本文が変わらなくても disk cache を invalidation する。process 内では repository root ごとに catalog instance を 1 つだけ作り、lint process が終わるまで作り直さない。source を書き換えても同じ process には反映されず、次の process が fingerprint の差で cache miss を出す。

各 input の repository-relative path と本文を、長さで境界を付けて順序どおり hash に入れる。size と mtime が同じまま本文が変わっても cache hit にはならない。owner source、import・spread・JSON・declaration が供給する型、公開 route、dependency 解決条件のいずれが変わっても cache miss になる。`commentSources` は strict annotation scan、`declarationSources` は production runtime owner 候補という従来の意味を維持し、cache の完全性のために範囲を広げない。

version 5 entry は次を持つ。

- concept id、binding、package name
- declaration path
- annotation、binding、declaration の各 offset
- specifier、export name、exports field から解決した repository-relative source path 群からなる public import route
- `null` を含む canonical values と、その型付き fingerprint

cache payload は version、input fingerprint、entries から再計算できる integrity hash も持つ。cache read は integrity に加え、concept id、nonempty binding・path、route がある場合の nonempty specifier・export name・重複のない repository-relative source path、offset の順序、値の型・有限性・一意性、値から再計算した fingerprint を検証する。entries の削除・置換を含め、1 つでも不整合があれば cache 全体を miss として再構築する。version 4 以前の payload は、fingerprint が一致していても必ず破棄するため、旧 shape の poison concept・value・range を version 5 catalog へ注入できない。version 4 を導入する途中で書かれた source identity を持たない route shape も、同じ検証で cache miss にする。

repository package 名は valid entry の有無から推測せず、現在の package manifest から catalog に保持する。invalid・duplicate・out-of-scope owner によって entry が 0 件になった package も repository package であり続けるため、正規 route に一致しない root・subpath・binding を外部依存へ誤分類しない。この集合は cache hit 時も現在の manifest から導出する。

cache file は `node_modules/.cache/mst-dont-review-it/canonical-values.json` に置く。書き込みは process 固有の temporary file を完成させてから rename し、reader が partial JSON を見ないようにする。環境要因で書き込めなくても、今回構築した memory 上の catalog を返し、次の process が再構築できる状態を保つ。

この cache を使うのは lint だけである。`dont-review-it check` は cache を読まず、repository analysis を毎回 1 回 strict に実行する。out-of-scope annotation や不正 annotation は lint catalog の entry にならず、strict analysis では problem になる。equivalent concept はその strict inspection に problem がない場合だけ同じ catalog から照合する。

## 影響

注釈 scanner、TypeScript checker による値域導出、public symbol 解決、declaration identity、entry shape のいずれかを変える変更は、cache version を確認する責務を持つ。上げ忘れると source fingerprint が同じ環境で旧解釈が残るため、実装変更と version 更新を分けない。

cache hit でも、両 lint rule は現在の source を再走査し、entry の path・binding・concept id・全 offset が一致した declaration range だけを免除する。version 5 の正規 entry であっても、現在の source と identity が違えば免除に使わない。input fingerprint は本文を読むため、同じ size・mtime に戻した source 変更も stale entry を残さない。

strict verification が cache に依存しないため、cache の欠損・破損・書き込み不能は repository の正当性判定を弱めない。lint は cache miss の費用を払い、同じ analysis から有効 entry だけを使う。

## 検討して採らなかった案

**catalog を生成物として commit する。** 注釈を編集した人に更新手順を課し、古い生成物を正規情報として残す。

**source fingerprint だけで互換性を判断する。** source が同じまま抽出ロジックや entry shape が変わる場合を検出できない。

**CLI の strict verification も cache を使う。** invalid・duplicate・out-of-scope の problem を持たない lint 用 entry cache だけでは、repository 全体の fail-closed な判定にならない。

**最終 path へ直接書き込む。** 並行 lint process が partial または混在した payload を読めるため、temporary file からの rename を使う。
