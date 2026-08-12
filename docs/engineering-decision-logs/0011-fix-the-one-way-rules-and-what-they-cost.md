# 0011. 書き方を一方向に固定する 3 本を有効化し、その代償を名指しで引き受ける

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

`no-reassign--use-spread-or-iife` / `no-array-mutation--derive-new-array` / `no-promise-chain--use-async-await` の 3 本は、同じ不変条件を分担する。値は作られた後に変わらず、名前は一度だけ束縛され、非同期の失敗は呼び出し元の制御フロー上に現れる。

3 本とも、抑制ディレクティブを持たない設計で書かれている。オプションも持たない。有効か無効かだけを設定層が決める。

有効化して実際に走らせたところ、リポジトリ自身に 133 件の違反が出た。`no-promise-chain` は 0 件で、内訳は `no-reassign` と `no-array-mutation` である。抑制の口が無い以上、この 133 件は「直す」か「そのファイルを対象から外す」かのどちらかにしかならない。

## 決定

**ES2023 の copy-by-change 群を `no-array-mutation` の検出対象から外す。**

不変条件文書はこの群（`toSorted` / `toReversed` / `toSpliced` / `with`）を暫定で対象に含めていた。含める根拠は不変条件の違反ではなく「導出の書き方を 1 つに固定する」という様式の話だと、文書自身が書いている。

含めたままにすると、標準の手段で並べ替えができなくなる。文書はその前提条件として「非破壊の並べ替えヘルパを配備先で用意する」ことを求めているが、このルールの下でそのヘルパを自前で書く道は塞がっている。ヘルパの内側に書く `[...values].sort()` は、出自による免除を持たないという同じ文書の規定によって、そのまま違反として報告されるためである。外部の依存を足す以外の解が無い。

Node 24 以降はこの 4 つを持つ。外した結果、`toSorted` が並べ替えの正規の直し方になり、報告メッセージにも名指しで書ける。文書が未決としていた「ヘルパを何にするか」と「メッセージにヘルパ名を埋めるか」は、この決定と同時に消えた。

**どの配備先でも同じ値になる例外だけをルールが持ち、綴りが配備先ごとに変わるものは設定に書く。** 例外の置き場所は 2 つある。ルールが持つ値と、配備先の設定が渡す値である。分ける基準は「ツールの規約かどうか」ではなく、**その値がどの配備先でも同じかどうか**である。抑制の口を作らないという設計は両方で守る。

ルールが持つのは 1 つだけになった。`no-reassign--use-spread-or-iife` の `process.exitCode` である。プロセスの終了コードを module スコープの入口から返す手段は代入しか無く、`process.exit` は書き込みの完了を待たない。この制約は言語処理系の側にあるので、どの配備先で書いても同じ形になる。オプションはこれを置き換えず、足すだけにしてある。

残りは配備先が名指しする。

- `no-default-export--use-named-export` の `toolRequiredFileNames` は既定が空。`vite.config.ts` は Vite を使う配備先にしか存在せず、`plugin.ts` に至ってはどのツールも要求していない綴りで、oxlint が読むのは `jsPlugins` の指定子が指すファイルである。つまりどちらも mst の都合であって、ルールが持てば持っていない配備先へ他所の綴りを配ることになる
- `no-reassign--use-spread-or-iife` の `RuleTester.describe` / `it` / `itOnly` は、lint ルールを書く配備先だけの事情である

mst の綴りはルート `vite.config.ts` の `rules` に置いた。配布する `packages/dont-review-it/src/configs/oxlint.ts` には置いていない。あれは他のリポジトリが読む preset であり、mst のファイル名を配る場所ではない。

名指しの粒度も揃えた。`toolRequiredFileNames` が通すのは直接の `export default` だけで、同じファイルの `export { total as default }` と `export = total` は報告され続ける。ツールが要求しているのは 1 つの形であって、`default` という名前を外に出す手段すべてではない。`overrides` でファイルごとルールを止めると、この区別が消える。

設定側の `overrides` に残したのは 1 か所だけである。`apps/website/src/**` は Vite+ のスキャフォールド生成物で、カウンタの状態はイベントハンドラをまたいで保つもの、つまり不変条件文書が「管理された可変境界」として未決にしている領域そのものである。かつ mst の規約はスキャフォールド生成物を独自設計に置き換えないと定めている。

**canonical owner の構文上の位置は `oxc-parser`、解決済みの意味は `typescript-6` で読む。** `declarations.ts` は source ごとに `parseSync` を 1 回呼び、comment と top-level statement の範囲だけを扱う。module-scope の JSDoc と、その末尾から空白だけを挟んで続く単一 variable statement・単一 Identifier binding・runtime initializer を owner 候補にする。line comment、通常の block comment、nested annotation、intervening comment、ambient declaration、type alias、enum、function、class、import、re-export、制御文は owner にしない。

Oxc AST は owner の構文上の位置と declaration range を確定する。owner 候補は最寄りの TypeScript configuration ごとに先にまとめ、catalog builder は configuration ごとの `typescript-6` Program と checker で同じ binding の値域を解決する。array の numeric index type にある literal union、または index signature を持たない object の property name を値域にする。checker が解決する import と spread は同じ型へ畳まれ、empty・widened・scalar・非 literal domain・直接記述された重複値は problem にして entry を作らない。

public import route も同じ checker で package entry の export symbol を解決する。specifier、export name、exports field が解決した repository-relative runtime source path 群を、owner symbol と同じ declaration identity を指す場合だけ登録する。consumer で解決した実体 path が別 source なら、specifier と export name が同じでも未登録 route にする。package exports の `types` condition が同じ workspace package の declaration file を返した場合は、登録済み runtime source と同じ package root に属することを確認して登録 route とみなす。`paths` で specifier を別 runtime source または declaration file へ向けた解決は未登録のままにする。相対・絶対 import は実在する consumer に対する TypeScript の解決結果を優先し、競合する `.ts` と `.tsx` を拡張子除去で同一視しない。renamed alias は公開名で登録し、shadow export は名前が同じでも登録しない。parser AST を再帰して import・spread・re-export の評価器を自作する経路は持たない。

注釈 scanner、runtime provenance、owner stability、source identity、route resolution、entry shape が変わったため、[0006](0006-version-the-derived-catalog-cache.md) に従って `CACHE_FORMAT_VERSION` は 5 である。version 4 以前の cache は source fingerprint が一致しても読み込まない。

**library vocabulary と canonical catalog で TypeScript の用途を分ける。** `typescript` package の `typescript/unstable/sync` は、直接依存の公開型から lint message に載せる候補を収穫するためだけに使う。遅延起動し、環境要因で起動できなければ空の候補へ退避しても lint の報告箇所は変えない。

`typescript-6` は canonical owner の値域と public symbol identity を決める correctness-critical な checker として使う。ここで解決できない owner は catalog entry を持たず、strict analysis の problem になる。起動不能や型解決失敗を parser-only の値評価へ退避しない。2 package は別 API・別失敗条件・別責務を持つため、どちらも `@mst/dont-review-it` の runtime dependency とする。`typescript-6` はこの workspace だけが使うため package manifest で固定し、複数 workspace が共有する `typescript` だけを dependency catalog に置く。

**consumer は明示した構文だけを visitor より前に索引化する。** 二本の canonical rule は `create` 時に Oxc AST 全体を一度走査し、module-scope の静的 array・object binding、named import、schema・type・Set・indexed access・JSON Schema の sink、canonical literal を不変な診断配列へ変換してから visitor を返す。visitor は `Program` で完成済み診断を報告するだけで、走査順に名前や候補値を更新しない。

consumer 側に JavaScript の abstract interpreter を置かない。callback の実行、標準 API の返値、collection mutation、`call` / `apply` / `bind` の正規化を一般化すると、lint rule が JavaScript 実行系を再実装することになる。対象を増やす場合は、語彙を定義する明示的な syntax contract と耐久テストを追加する。owner の import・spread・public export は TypeScript checker に任せ、consumer の値域評価へ同じ解決処理を重複実装しない。

named import は TypeScript module resolution で実体 source を解決し、catalog の specifier・export name・source identity と照合する。catalog owner と同名の ambient・local bindingを綴りだけで登録済みとみなさない。repository scan と route 判定は `git ls-files --others --ignored --exclude-standard --directory` から作った不変の source scope で未追跡 source を一括で取り除き、tracked source は ignore pattern に一致しても repository source として維持する。

source scope、repository file 一覧、cache fingerprint、catalog は lint process の最初の rule 作成より前に一度だけ確定し、全 file と両 canonical rule が同じ instance を共有する。CLI の strict verification と明示的な catalog reload は現在の fingerprint を再計算するが、visitor と import route lookup は Git command や repository scan を実行しない。

**汎用の処理は `es-toolkit` を使う。** 単一代入への書き換えで、同じ形が何度も出た。try/catch で失敗を握って既定値に落とす形、比較関数を手書きして並べ替える形、2 回 filter して集合を分ける形、遅延初期化。これらを `attempt` / `sortBy` / `partition` / `memoize` / `uniq` / `range` に置き換えた。両パッケージの実行時依存に入れている。

**CLI の検査結果は `check` の report として一度だけ組み立てる。** canonical owner の問題と equivalent concept は同じ inspection を共有し、owner problem があるときは不完全な catalog から equivalent concept を報告しない。Citty の `check` subcommand がほかの repository check と同じ report にまとめ、プロセスのストリームと exit code を扱う。

## 影響

有効化の代償は、リポジトリ全体で 133 か所の書き換えだった。今後は書いた時点で止まるので、この規模の一括修正は繰り返さない。

例外に入れた形は、ルールが黙っている場所であって、書き方が認められた場所ではない。増やすときは同じ水準の理由が要る。ルールに足すなら「どの配備先でも同じ値になること」、設定に足すなら「この配備先の綴りであること」を示す必要がある。

ルールを取り込んだだけの配備先は、自分の `vite.config.ts` で `no-default-export--use-named-export` に当たる。当たってから `toolRequiredFileNames` に自分の綴りを書くことになる。設定を書かずに通る状態にはしていない。ルールが黙る綴りを配備先が知らないまま持つより、当たって書くほうを採った。

`no-promise-chain` は 0 件だった。このリポジトリに Promise チェーンが 1 つも無いことを意味するので、現時点では回帰の防止にしか効いていない。

`declarations.ts` の owner 候補は Oxc parser の構文と誤り回復に従う。候補になった binding の値域・import・public export は `typescript-6` の program と checker に従い、解決できない候補だけが catalog から除外される。CLI は同じ除外理由を strict problem として返す。

TypeScript checker は 2 系統になる。library vocabulary checker の障害は message の候補だけを薄くし、canonical checker の失敗は owner 登録を失敗させる。この差を崩すと、環境によって lint 合否が変わるか、不正 owner を syntax fallback で登録することになる。

consumer の解析は 1 file につき 1 回だけ行う。schema、JSON Schema、type indexed access、`Set` は同じ module-scope binding と import route の索引を共有し、visitor の走査順には依存しない。

declaration source index も source の visitor 実行前に完成している。consumer identifier の range から checker symbol の declaration source を引く lookup と、AMD dependency specifier の一覧だけを visitor に渡す。visitor 中に repository scan、tsconfig 探索、program 作成を始める経路は持たない。

`bin` が `dist/cli.mjs` を指していると、素のチェックアウトでは対象が存在せず pnpm が bin リンクを張らない。`vp install` を 2 回打つまで `vp exec dont-review-it check` が動かない状態になっていた。`bin` を `src/cli.ts` に向けて解消している。[0004](0004-shape-the-lint-rule-foundation-around-tooling-limits.md) が plugin の指定子について書いているのと同じ理由で、src は常に存在する。

## 検討して採らなかった案

**`declarations.ts` だけを 2 ルールの対象から外す。** 最小の変更で緑になる。ルールを入れた当のリポジトリが、最大のファイルを例外にすることになる。

**自前トークナイザを単一代入に書き換える。** 抽出の解釈が変わらないのでキャッシュ版を上げずに済む。一方でトークン数だけ再帰が深くなり、大きなファイルでスタックに当たる。字句解析器を自前で持ち続ける理由も無い。

**consumer の値追跡を source 順の名前 `Map` と resolver 群の追加で延命する。** scope shadowing、前方 type alias、別関数の write、destructuring、property の後勝ち、partial bind を resolver ごとに実装することになり、同じ route が schema では報告されても `Set` では消える。binding・property・invocation・type を共通の候補集合へ落とす二相解析へ置き換える。

**`getStaticValue` と `ReferenceTracker` を解析の中核にする。** global・ESM・CommonJS の API access と単一の静的値には使えるが、local object を通る callable、bound arguments、candidate の分岐 join、property invalidation、型 alias を同じ結果にできない。限定した補助より大きい責務を持たせない。

**copy-by-change 群を対象に残したまま、外部の非破壊ヘルパを依存に足す。** 並べ替えのためだけに依存が 1 つ増える。言語が既に持っている手段を禁じて別の手段を持ち込むことになる。

**`plugin.ts` と `vite.config.ts` をルールの既定に置く。** 取り込んだ配備先が設定を書かずに通るので、最初の導入が楽になる。しかし `plugin.ts` はどのツールも要求していない綴りで、mst が付けた名前でしかない。ルールに置けば、その名前のファイルで default エクスポートが通る配備先が黙って増える。ルールが知ってよいのは、どの配備先でも同じ値になるものだけである。

**mst の綴りを配布する preset（`configs/oxlint.ts`）に置く。** ルールよりは配備先寄りだが、あれは他のリポジトリが読む設定である。mst のファイル名をそこに置けば、結局は他所へ配ることになる。
