# no-strict-canonical-literal-use--use-canonical-import

## 何を検出するか

production のソースにある文字列・数値・真偽値・`null` のリテラルのうち、値がカタログの語彙に属するもの。値の位置に書かれたリテラルと、同じ値のリテラル型ノードを区別しない。

拾う綴りの形は次のとおり。

- 文字列リテラル、数値リテラル、真偽値リテラル、`null`
- 単項プラス・マイナスを重ねた数値リテラル。括弧や型 assertion を挟んでも、外側まで評価した符号付きの値を 1 度だけ報告し、内側の数値を別に数えない
- 置換のないテンプレートリテラル。`` `draft` `` は `"draft"` と同じ綴りである
- 有限の primitive だけから静的に確定する演算。`+` の加算・文字列連結、減算・乗算・除算・剰余・累乗・shift・bitwise、`typeof` を含む単項演算、template interpolation は、断片でなく式全体の値を 1 度だけ報告する
- `String` の `concat` / `slice` / `raw` / `fromCharCode` / `fromCodePoint`、array の `join`、primitive 変換、`parseInt` / `parseFloat`、静的な `Math` メソッドから確定する値。binding、property、分割代入、代入 write、引数、`bind` / `call` / `apply` / `Reflect.apply` を経由しても同じ CandidateSet へ畳む

このルールは使用箇所の構文形に依存しない。だから宣言側ルール [no-local-finite-value-set--use-or-register-canonical-values](./no-local-finite-value-set--use-or-register-canonical-values.md) が意図的に文法の外に置いている形も捕まえる。引数や戻り値の位置に直接書かれた合併、リテラルとの等値比較、`switch` の `case`、関数やコンストラクタへのリテラル引数がこれにあたる。

1 つの値が複数の概念に属する場合、1 つの報告に該当する概念と公開経路を全部並べる。カタログの順序で 1 つを選ばない。公開経路が解決できない所有者は、その宣言ファイルで示す。

自動修正は持たない。報告のみを行う。

カタログの取得はルールの登録時に注入する。ルール本体はカタログの作り方を持たず、リポジトリルートを受け取ってカタログを返す関数を 1 つだけ受け取る。

### 例外はカタログが登録した initializer の正規値だけ

`@canonical-values` 注釈が付いた runtime owner の initializer で、その owner の正規値を綴るリテラルは報告しない。そこが概念を定義する場所だからである。ただし「注釈が付いている」ことは免除の条件ではない。免除が効くのは、**カタログ entry と現在の source が同じ declaration identity を持つ**場合に限る。条件は次の 6 つを同時に満たすこと。

- 注釈が `/** */` の JSDoc ブロックに書かれていること。行コメントと単星ブロックでは免除されない。カタログビルダーが走査するのが JSDoc ブロックだけだからである
- 注釈の直後に空白だけを挟み、runtime initializer を持つ module-scope の単一変数文・単一 Identifier binding が続くこと。ambient declaration、type alias、enum、関数、class、import、re-export、制御文は owner にならない
- 注釈が名指す concept id、binding、宣言 path が、カタログ entry と一致すること。別ファイル、別 binding、どこにも登録されていない concept id を書いても免除されない
- annotation、binding、declaration の各 offset が、現在の source を再走査した結果とカタログ entry の間で一致すること
- リテラルが owner の値を実際に供給する構文位置にあること。object owner では直接の property key と静的 object spread 内の property key、array owner では直接の element、透明な式の値側、sequence の末尾、conditional の両結果枝、静的 array spread 内の element に限る
- リテラルの値が、その owner entry の canonical domain に含まれること

注釈と宣言の対の判定と、現在の AST から initializer を特定する処理は宣言側ルールと同じ実装を共有する。2 本の lint rule は同じ catalog instance を使い、その entry と現在の source を同じ scanner で照合する。cache に古い range が残った場合も、現在の declaration identity と一致しなければ免除しない。

declaration の型注釈、`satisfies` と型 assertion の型、object の property value、sequence の末尾以外、conditional の条件、call argument は、initializer の内側で owner と同じ値を綴っていても報告する。initializer の span や owner declaration の range 全体を免除する扱いは持たない。

値を導出できるかどうかはカタログビルダーが決め、このルールは登録結果だけを見る。Oxc parser は構文上の位置と declaration identity を確定し、`typescript-6` の checker は binding type から array の literal union または object の property name を導出する。負数・`null`・checker が解決できる import と spread を扱い、empty・非 literal domain・直接重複を拒否する。値域を導出できない owner はカタログに載らないので免除されない。

カタログビルダーは checker の有限型だけで owner を受理しない。initializer の実行結果が同じ値域であること、owner が readonly であること、実行され得る alias・callback・container・暗黙 protocol・呼び出し経路から同じ object を変更できないことも検証する。標準 API の copy・read・identity を信頼するのは default library symbol に解決され、呼び出し前に global binding・static member・prototype member への到達可能な write がない場合だけである。owner の値域を供給できる外部式は、登録済み owner と repository 内 JSON に限る。未登録 TypeScript binding、`node_modules`、production 対象外 source、repository 外へ出る symbolic link は entry と免除を作らない。

暗黙 protocol の実行には property getter・setter、installed descriptor、Proxy trap、iterator を消費する spread・分割代入・`yield*`・`Array.from`、primitive coercion、computed property・element access・reflection API の property key coercion、`Symbol.hasInstance`、`toJSON`、object spread getter を含む。template interpolation、単項数値演算、loose equality が実行する `Symbol.toPrimitive` も同じ実行経路として扱う。`try` 内の coercion・accessor・iterator が throw し得る場合は `catch` も到達可能として検証し、宣言されただけで実行されない protocol body は owner mutation とみなさない。

duplicate concept は衝突した全 entry が除外される。test、Story、fixture など production 対象外の注釈も entry にならず、cache を使わない strict verification では problem になる。不正注釈、duplicate、out-of-scope、別 path、別 binding のどれにも免除範囲は無い。正規 owner であっても、owner の値を供給する構文位置または owner domain の外には免除範囲が無い。

これ以外の免除は存在しない。

- 語彙ごとの opt-out は無い
- ワークスペースごとの除外も無い
- 所有者を宣言しているワークスペース自身のファイルも対象になる。概念を所有していることは、その綴りを書き直してよい理由にならない
- 同じファイルで所有者を import していても、そのファイルの別の生リテラルは免除されない。使用箇所ごとに独立して判定する

### 構造上のキー選択は使用箇所ではない

既存の型からプロパティを選ぶ構文の中のリテラルは、その型自身が綴りを所有しているので対象外になる。

- 標準 utility type の `Pick<T, K>` と `Omit<T, K>` の第 2 型引数。字句 scope に同名の local・import binding が無い場合だけ標準 utility type とみなし、同名の型を定義・import して免除を偽装する形は報告する。別名を付けて import した `Pick` は認識しない
- 計算されないプロパティキー。オブジェクトリテラル、型リテラル、クラスのメンバー、interface と型リテラルのメソッドシグネチャ名、enum のメンバー名が該当する

一方、新しいキー集合を書き下ろす構文は対象になる。既存の型から選ぶのではなくキーの合併を新たに書くとき、そこに語彙を書き直すのは本物の迂回である。

- `Record<"draft" | "published", V>` のキー位置
- `Pick<T, K>` の第 1 型引数。ここは選択元の型を書く普通の型の位置であって、キーを選ぶ位置ではない
- `Exclude` と `Extract`。これらは型のキーを選ぶ操作ではなく合併を絞る操作なので、キー選択として扱わない

### そのほか対象にならないもの

- モジュール指定子。`import { load } from "draft"` の `"draft"` はパッケージ名であって語彙の要素ではない。`import` / `export ... from` / 動的 `import` / `import type(...)` / import attribute が該当する
- 文字列で綴られた import / export の名前。`import { "draft" as load } from "./loader.ts"` や `export { load as "draft" }` の `"draft"` はモジュールが公開する名前であって語彙の要素ではない
- 環境モジュールの名前。`declare module "draft"` の `"draft"` はモジュール指定子である
- 外部パッケージからの import
- テストのソース。ファイル名が `.test.` または `.spec.` を含むもの
- Story。ファイル名が `.stories.` または `.story.` を含むもの
- fixture と mock。ファイル名が `.fixture.` または `.mock.` を含むもの
- パスに `__fixtures__` / `fixtures` / `__mocks__` / `__tests__` / `__stories__` / `test` / `tests` のいずれかのディレクトリを含むファイル
- パスに `.cache` / `.local-agents` / `coverage` / `dist` / `dist-ssr` のいずれかのディレクトリを含む生成物・cache・agent artifact source

対象外にするパスの判定は宣言側ルールと同じ 1 つの実装を共有する。2 本で 1 組のルールの適用範囲が食い違わないようにするため。ただし production source から対象外 source へ到達する次の module 境界は報告する。境界の対象は Git が repository source として可視にしている path に限り、`git check-ignore` が除外する未追跡の生成物・cache・agent artifact は取り込まない。追跡済み file は後から ignore pattern に一致しても Git の source であり続けるので、対象外 path なら境界として報告する。

- import、re-export、dynamic import、`require`、import-equals、import type と、triple-slash reference、AMD dependency、対象外 declaration が供給する ambient global
- `jsxImportSource` pragma または TypeScript config が選ぶ JSX runtime、Vite config の resolve 設定、`import.meta.glob` の静的 pattern、`build.lib.entry` / `build.rollupOptions.input` / `build.ssr` が選ぶ build entry
- `Worker` / `SharedWorker`、service worker registration、worklet の `addModule`、`importScripts`、Node の worker threads、`module.register`、child process API が実行する module source と、Node の `fs` / `fs/promises` API が読み込む repository source
- Vite の asset query・CSS module・root-absolute source を含む、repository 内に実在する module または asset

module specifier が binding・property・分割代入・関数引数を通る形に加え、静的な文字列演算、`node:path` の `join`、tagged `String.raw`、string `slice`、`new URL(relative, import.meta.url)` で組み立てられる形も同じ source identity へ解決する。対象外 source に値を移して production へ戻す経路を、検査されない供給元として使わせない。

- 静的な候補を 1 つも取り出せない実行時の値

## なぜそれが要るか

有限個の値からなる語彙は、リポジトリのどこか 1 箇所で宣言され、他の全箇所はそこから導出する。この不変条件には守り方が 2 方向あり、宣言側だけでは穴が残る。正しく宣言された語彙を、各所が生リテラルで参照できてしまうからである。このルールは消費側を受け持つ。

リテラルで書き直された値は、宣言との間に何のつながりも持たない。宣言から値が 1 つ消えても、綴りが 1 文字変わっても、書き直した側では何も起きない。型検査は通り、テストも落ちない。壊れていることが表に出るのは実行時であり、しかもその綴りを受け取る側が別のデプロイや別のシステムにあると、表に出るのはさらに後になる。

自動修正を持たないのは、値が一致することが同じ概念であることの証明にならないからである。同じ綴りが別々の概念に属することがあり、どちらの所有者に属するかは周囲の振る舞いを見なければ決まらない。加えて安全な置換には、所有者の公開経路が 1 つに定まっていること、局所の束縛名と衝突しないこと、周囲の構文を保ったまま置き換えられることが必要で、どれも機械が決定的に導けない。だから機械は候補を並べるだけで、選ぶのは人である。

## どう直すか

報告された使用箇所で、その語彙を所有する側の公開経路を値の供給元にする。公開経路が無い場合は、報告に示された宣言ファイルを使う。

複数の概念が並んだときは、周囲の振る舞いと所有の境界で選ぶ。綴りが同じであることを理由に選ばない。

綴りの方言が使用箇所に現れる場合、たとえば同じ概念が大文字と小文字の別表記で使われている場合は、所有者が公開している変換を使う。局所のリテラルを新しく作らない。

所有者のワークスペース内にあるファイルも、他のファイルと同じように所有者の束縛を使う。

報告された値が示された概念とは別物だった場合、それはまだ宣言されていない別の概念である。周囲の振る舞いがその綴りに依存しているから、その値がソースに固定されている。所有するべき場所に登録して、報告箇所からそれを使う。2 つの概念が同じ綴りを持つことは正当であり、直し方は両方を宣言することであって、片方を抑制することではない。

## 禁じる回避策

**このルールは抑制の口を 1 つも持たない。** 使用箇所ごとの抑制も、所有者側の opt-out タグも、manifest の除外フィールドも用意しないし、今後も追加しない。抑制の口を 1 つでも残すと「面倒だから除外」が積み上がり、語彙を 1 箇所に集めること自体が崩れる。過去に存在した除外用のタグ（`@canonical-values-exempt` / `@canonical-values-ignore` / `@canonical-values-skip`）は、検証エントリポイントが明示的に拒否する。

- 語彙を別の構文へ書き換えて判定の文法から逃れる。置換のないテンプレートリテラル（`` `draft` ``）は文字列リテラルと同じ綴りとして報告する
- 注釈を使用箇所の近くに置いて免除を作る。免除の条件はカタログへの登録であって、注釈が書かれていることではない。カタログが取り込まない位置・構文・概念 id に注釈を置いても免除は発生せず、そこに書いたリテラルはそのまま報告される。値を持たない注釈は検証エントリポイントが拒否し、同じ概念 id を 2 箇所で宣言すれば重複として拒否される
- 綴りを分割して連結する、算術や変換を挟む、文字コードから組み立てるなど、ソースにその綴りが現れない形にする。静的に値を確定できる式は、binding・property・呼び出しをまたいでも式全体の値として報告される。値の供給元が 1 箇所でなくなる点は生リテラルと同じであり、読み手からは供給元がさらに見えなくなる
- 使用箇所を対象外のファイルへ移す。テストや fixture のディレクトリに production の値を置いても、そこから import した先で綴りが固定されることは変わらない。production から対象外 source を参照する module 境界自体を報告する

## オプション

`ownershipPolicy` を文字列で受け取る。所有権の割り当て方針を報告メッセージの末尾に載せるためのもの。

このパッケージは「どこが所有すべきか」の内容を持たない。方針は利用側の構成に固有なので、文字列として渡してもらう。方針の例としては、サービス全体の運用語彙・API の通信プロトコル・アプリ固有の状態、といった区分が置かれる。

未設定のときは、方針が設定されていないことを報告に書く。報告を受けた人が、方針を決めるところから始める必要があると分かるようにするため。パッケージが既定の方針文を名乗ることはしない。この解釈と選択肢のスキーマは宣言側ルールと同じ 1 つの実装を共有する。

オプションで検出範囲を狭めることはできない。`ownershipPolicy` が変えるのはメッセージの文面だけである。
