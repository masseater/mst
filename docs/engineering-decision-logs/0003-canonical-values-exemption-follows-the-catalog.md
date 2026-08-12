# 0003. 語彙の免除はカタログへの登録に従わせる

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

有限値の語彙は、repository 内の 1 つの runtime binding だけが所有し、型・schema・membership check を含む全 consumer がその binding から導出する。これを守る処理は 3 つある。

- catalog analysis は `@canonical-values` と runtime variable を対応させ、値域と import route を導出する
- `dont-review-it verify` と `equivalent-concepts` は repository 全体を strict に解析し、不正注釈・対象外注釈・値域を持たない declaration・duplicate concept を problem にする
- 2 本の lint rule は catalog を読み、owner initializer と登録済み値域が一致する定義だけを報告対象から外す

注釈の存在だけを免除条件にすると、catalog entry を作れない位置・構文・値域でも lint を止められる。ファイル名の suffix、concept id だけ、または declaration の広い範囲だけで照合しても、別 path・別 binding・古い cache range が owner を名乗れる。免除条件は、catalog analysis が正規 owner として登録した declaration identity そのものに従属させる必要がある。

## 決定

### runtime owner の形を 1 つにする

owner として受理するのは、production の TypeScript source にある module-scope の JSDoc `@canonical-values` と、その直後に空白だけを挟んで続く単一 variable statement である。

- JSDoc 内の canonical tag は 1 つだけにする
- variable statement は単一の Identifier binding と runtime initializer を持つ
- concept id は小文字英数字の語を `-` または `.` でつないだ形にする
- line comment、通常の block comment、nested annotation、間に別 comment や token がある形を受理しない
- ambient declaration、`.d.ts`、multi-binding、destructuring、type alias、enum、function、class、import、re-export、制御文を owner にしない

Oxc parser は comment、top-level statement、binding、annotation・binding・declaration の各 offset を確定する。値域の評価は行わない。

`typescript-6` の checker は同じ binding の解決済み type を読み、array の numeric index type にある literal union、または object の property name を値域にする。文字列・数値・真偽値・`null`、負数、checker が解決できる import と spread を扱う。empty、非 literal domain、直接記述された重複値は problem にして entry を作らない。

checker の有限型だけでは owner の実行時同一性を証明しない。initializer の実行結果が同じ有限値域になること、binding が readonly であること、repository 内で実行され得る処理から同じ object を変更できないことも登録条件にする。alias、分割代入、論理式、引数、callback、暗黙の言語 protocol、container への格納と取り出し、`call` / `apply` / `bind` を同じ object identity として追跡する。未解析の呼び出しが mutable parameter で owner を受け取る場合は entry を作らない。

暗黙の実行点には property getter・setter、installed descriptor、Proxy trap、spread・分割代入・`yield*`・`Array.from` の iterator、primitive coercion、computed property・element access・reflection API の property key coercion、`Symbol.hasInstance`、`toJSON`、object spread の getter を含める。template interpolation、単項数値演算、loose equality も `Symbol.toPrimitive` を実行する構文として追跡する。`try` 内の式を non-throwing と確定するのは、primitive 演算と accessor・iterator を実行しない静的な分割代入を証明できる場合に限る。宣言しただけで実行されない accessor・protocol body は owner を拒否する理由にしない。

配列の要素が canonical primitive だけなら、spread、`slice`、`concat`、`Array.from` などが作る配列は別 identity であり、その copy の変更は owner の変更にしない。`Object.keys` などの列挙、`Array.isArray`、`JSON.stringify` も owner の primitive array を読むだけなら変更にしない。一方、container が owner object 自体を要素として保持する場合、copy 後の要素から owner を変更できるため同一性を保つ。

標準 API の copy・read・identity として扱うのは、TypeScript の default library symbol に解決され、その呼び出しより前に global binding、static member、prototype member への到達可能な write がない場合だけにする。直接代入に加えて `Object.defineProperty`、`Object.defineProperties`、`Object.assign`、`Reflect.defineProperty`、`Reflect.set`、`Object` / `Reflect` の `deleteProperty` と `setPrototypeOf` による write も同じ runtime property lookup の変更として扱う。global constructor や prototype object の祖先 path の置換と `__proto__` write も descendant method を不安定にし、呼び出し後だけにある write は既に終わった処理の意味を変えない。

owner の値域を供給する式は、owner initializer 自身、repository 内で登録に成功した別 owner、または repository 内の JSON source に由来しなければならない。未登録の TypeScript binding、`node_modules`、production 対象外 source、repository 外の実体を持つ symbolic link は値域を供給できない。解析 input に repository 外へ出る symbolic link が 1 つでもあれば cache と strict analysis のどちらも entry を作らない。

### analysis result を catalog・verification・lint で共有する

repository analysis は、正規 declaration identity、成功した catalog entry、全 problem を 1 回の解析結果として返す。不正注釈は黙って捨てず problem にする。duplicate concept は、最初に見つかった declaration を含む衝突した全 declaration を解決対象から外し、任意の 1 件を owner に選ばない。test、Story、fixture など production 対象外 source の注釈も problem にし、entry を作らない。

lint は、この analysis から problem のある候補を除外した catalog を versioned cache 経由で読む。CLI の `verify` と `equivalent-concepts` は cache を使わず同じ analysis を strict に実行する。strict analysis に problem が 1 件でもあれば成功扱いにしない。

### 両 lint rule の免除を完全な identity に限定する

2 本の lint rule は、1 ファイル内で同じ catalog instance を共有する。免除 range を作る前に現在の source を Oxc parser で再走査し、次を catalog entry と完全一致させる。

- repository root からの declaration path
- concept id と binding
- annotation start、binding start、declaration start、declaration end

一致した declaration range から現在の AST にある initializer を特定し、型 assertion、`satisfies`、括弧、non-null assertion を外した式の span を使う。`no-local-finite-value-set--use-or-register-canonical-values` は、検出した有限値集合の span がこの initializer span と完全一致し、その fingerprint が entry と一致するときだけ免除する。`no-strict-canonical-literal-use--use-canonical-import` は、entry の canonical domain に属するリテラルのうち、owner の値を実際に供給する構文位置だけを免除する。object owner では直接の property key と静的 object spread 内の property key、array owner では直接の element、透明な式の値側、sequence の末尾、conditional の両結果枝、静的 array spread 内の element が該当する。

declaration の型注釈、`satisfies` と型 assertion の型、object の property value、sequence の末尾以外、conditional の条件、call argument は、initializer 内にあり同じ値を綴っていても owner の値を供給しないので免除しない。invalid、duplicate、out-of-scope、値域導出失敗、別 path、別 binding、現在の source と一致しない cache entry は、どちらの lint rule にも免除を作らない。

公開 import route は package specifier、export name、exports field から解決した repository-relative runtime source path 群で登録する。exported symbol を checker で解決し、owner symbol と同じ declaration を指す場合だけ登録する。consumer で TypeScript が repository 内 runtime source を解決できたら、その実体 path も登録済み source path のいずれかと完全一致させる。package exports の `types` condition により同じ workspace package の `.d.ts` を解決した場合だけ、登録済み runtime source と同じ package root に属することを同一性として使う。`paths` で同じ package specifier を別 source や `.d.ts` へ向けた解決にはこの扱いを適用しない。renamed alias は公開名で登録し、同じ package の shadow export は登録しない。相対・絶対 import は実在する consumer から TypeScript が解決した path と declaration path を完全一致させ、拡張子を一律に除去して比較しない。

### property name の由来を単一の domain として追跡する

`keyof` と `Object.keys` が作る property name は、expression、同一ファイル内の declaration、repository import route を共通の property-name origin として表す。object literal、type literal、interface、class、namespace、enum、type alias、generic substitution、declaration merge、heritage、intersection、union、key を保つ utility type をこの origin へ集約し、sink ごとに別の property evaluator を持たない。

`keyof` は TypeScript の key identity に従い、数値 property name を数値 literal のまま保持する。`Object.keys` は runtime の enumerable own string key に従い、数値 property name を文字列化する。class の static field は TypeScript の `private` / `protected` を含め、method・accessor・`declare` field・`#private` field は含めない。

computed property key は JavaScript の `ToPropertyKey` として解決する。静的に確定する `Symbol.toPrimitive`、`toString`、`valueOf` と boxed primitive は property key の投影だけで文字列化し、一般の primitive 値域へ object を混入させない。標準 constructor と symbol は字句 scope で global identity を確認し、同名の local binding を標準変換として扱わない。

候補集合は既知の候補と完全性を別に保持する。unknown computed key、unknown spread、未解決の構造が加わっても既知の property name、property value、repository route を捨てない。無条件の schema sink は open な集合の既知の局所候補を報告し、`keyof`・添字アクセス・`Set` は閉じた局所集合または一致する catalog fingerprint を必要とする。未登録 repository route は完全性と fingerprint に依存せず報告する。

named type import、`keyof import(...)`、import した runtime object の `Object.keys` は、TypeScript が解決した source identity と import 名を property-name origin に残す。登録済み route だけを canonical owner からの導出として扱い、repository 内の別 binding・別 source・未登録 subpath は property name が静的に分からない場合も未登録 route のまま保持する。

有限 primitive 型も同じ CandidateSet に畳む。literal union、enum、template literal、generic substitution、intersection、conditional type に加え、標準の `Extract` / `Exclude` / `ReturnType` / `Parameters` / `Awaited`、直接の indexed access、conditional `infer`、文字列 intrinsic utility、mapped type の `keyof` を共通の型 domain として扱う。標準 utility は字句 scope で global identity を確認し、同名の local alias がある場合はその alias の定義を解決する。

### 静的な primitive 構築を単一の CandidateSet に畳む

literal、template、単項・二項演算、binding、property、呼び出しの結果は、既知候補と完全性を分けた同じ primitive CandidateSet へ畳む。`String`、array `join`、primitive 変換、数値 parse、`Math` の静的メソッドは invocation の正規化後に評価し、global identity と import source identity が一致する場合だけ標準処理として扱う。同名の local binding は標準 producer にならない。

既知候補と unknown が同時に届く場合は既知候補を残した open set にする。無条件の vocabulary sink と strict な使用箇所は既知候補を報告し、fingerprint 一致を必要とする sink は open な局所集合だけでは報告しない。BigInt の型混在、例外になる演算、静的に解決できない receiver・argument は unknown として保持する。

production から対象外 source へ向かう module specifier もこの primitive resolver を使う。文字列演算、`String.raw`、string `slice`、`node:path` の `join` は通常の string result として解決する。`new URL(relative, import.meta.url)` は primitive ではないため module-specifier projection だけが relative candidate を受け取り、一般の値域へ URL object を string として混入させない。

## 影響

正規 owner の initializer そのものと、その initializer で正規 owner の値を実際に供給するリテラルだけが免除される。initializer 内でも property value、捨てられる式、型側、call argument は免除されない。owner declaration の型注釈、initializer 内の別値域、owner と同じファイルの別 literal、同じ package の別 file、同じ concept id を書いただけの declaration も免除されない。

壊れた注釈は lint の catalog entry を持たないため、所有権や免除を作れない。repository 全体の不整合は uncached strict verification が必ず problem として返す。lint の局所的な可用性と、CLI の fail-closed な完全性を同じ analysis result から分けられる。

値域は checker の解決結果に従うので、initializer の構文から値を独自に導出する評価器は持たない。lint 側の AST 判定は、catalog の値を綴る候補が owner の値を供給する構文位置かだけを判定する。import・spread・alias export を TypeScript と別の意味で解釈する経路は持たない。

## 検討して採らなかった案

**注釈が見つかった statement をそのまま免除する。** catalog entry を作れない注釈でも lint を止められ、抑制タグと同じ働きになる。

**concept id と file path だけを照合する。** 同じ file 内の別 declaration、suffix が同じ別 path、source edit 後の古い range を区別できない。

**一致した declaration range 全体を免除する。** owner の型注釈に同じ値域を書き直すことも、object value や nested expression に別 concept の生リテラルを書くことも隠せる。declaration identity は owner を特定する条件であり、その中の全構文を owner domain とみなす条件ではない。

**Oxc AST の initializer を再帰走査して値を導出する。** TypeScript が解決する import・spread・alias・literal type と別の評価器になり、両者の結果がずれる。

**type alias、enum、ambient declaration を owner として受理する。** runtime binding が存在せず、consumer が同じ実行時値から導出するという不変条件を満たせない。
