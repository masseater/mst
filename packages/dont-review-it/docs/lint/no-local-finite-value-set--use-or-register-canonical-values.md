# no-local-finite-value-set--use-or-register-canonical-values

## 何を検出するか

production の TypeScript ソースで、文字列・数値・真偽値・`null` からなる有限の語彙を定義している構文。

無条件に報告する形は次のとおり。カタログに一致する項目が無くても報告する。

- スキーマの列挙に、スカラーリテラルの静的な配列を渡す呼び出し。メンバ名が `enum` / `picklist` の呼び出しを対象にする。配列を直接書く形に加え、同一ファイル内の字句束縛、alias chain、分割代入、object member・spread、静的な computed key、default parameter、代入 write、引数 spread を経由する形も辿る。スキーマ関数自体を alias、object property、分割代入、条件式へ移した形と、`bind` / `call` / `apply` / `Reflect.apply` で呼び出す形も同じ invocation として扱う
- スカラーのリテラル型を並べた型エイリアス（`type OrderStatus = "draft" | "published"`）
- primitive の有限型を宣言する enum と型エイリアス。string enum、const enum、自動採番を含む numeric enum、template literal type、generic substitution、intersection、conditional type、`Extract` / `Exclude` / `ReturnType` / `Parameters` / `Awaited`、直接の indexed access、conditional `infer`、文字列の intrinsic utility、mapped type の `keyof` を静的な CandidateSet に畳む。標準 utility として扱うのは同名の字句 binding がない場合だけで、local alias はその定義を辿る
- リテラルのスキーマを並べた `union` 呼び出し（`z.union([z.literal("draft"), z.literal("published")])`）
- JSON Schema の `enum` キーに静的な配列を書いた形。自前 lint ルールのオプションスキーマがこれに当たる
- `keyof` が閉じた property name の有限集合を定義する形。object literal、type literal、interface、class の instance / static side、namespace、enum、同一ファイル内の type alias と generic substitution、declaration merge、heritage、intersection、同じ key を共有する union、`Readonly` / `Partial` / `Required` を辿る

property name の配列を作る `Object.keys` は、上のスキーマ呼び出しと `Set` の入力として同じ値域 resolver に渡す。object の alias・spread・静的 computed key と、`Object.keys` 自体の alias・分割代入・`call` を辿る。computed key は JavaScript の `ToPropertyKey` として評価し、静的な `Symbol.toPrimitive` / `toString` / `valueOf` と、`String` / `Number` / `Boolean` / `Object` の boxed primitive を property key に限って文字列化する。同名の local binding が標準 global を shadow した場合は標準変換にしない。boxed primitive を一般の値域へ primitive として混入させることもしない。runtime の enumerable own property に合わせ、class の static field は TypeScript の `private` / `protected` を含め、method・accessor・`declare` field・`#private` field は含めない。`keyof` は数値 key を数値 literal のまま保ち、`Object.keys` は JavaScript と同じく文字列化する。

既存のカタログ項目と値の指紋が一致したときだけ報告する形は次の 2 つ。一致しなければ報告しない。

- 添字アクセスの要素型を定義するための静的な配列（`const STATUSES = [...] as const;` と `type OrderStatus = (typeof STATUSES)[number];` の組）
- 静的な `Set` の初期化子（`new Set([...])`）

この 2 つは語彙と無関係なコードにも同じ形で現れる。だから構文だけでは判断せず、値そのものが既に宣言済みの語彙と一致したときに限って候補として扱う。import から受け取った値でも同じで、指紋が一致する所有者が見つからない限り報告しない。

ただし、登録済み owner の配列を spread したうえで局所値を足した配列は、`Set` と添字アクセスでも報告する。正規 owner を参照した事実は、新しい値集合を consumer 側で所有してよい理由にならない。追加値を scalar の alias に移しても同じ集合として解決する。

登録済み owner から作った配列や `Set` をあとから静的に変更する形も同じである。配列の `push` / `unshift` / `pop` / `shift` / `splice` / `fill` / `copyWithin` / `reverse` / `sort`、`length` と index への直接・更新・複合・論理・分割代入、`Set` の `add` / `delete` / `clear`、`Object.assign` / `Object.defineProperty` / `Object.defineProperties` / `Reflect.set` / `Reflect.defineProperty` / `Reflect.deleteProperty` は、一つの collection identity の状態遷移に畳む。object・array・分割代入を通る alias、mutator 自体の alias、呼び出された callback・helper、`bind` / `call` / `apply` / `Reflect.apply` を経由しても同じ実効集合として扱う。実効値域が変わらない操作と、静的に到達不能な分岐、実行されない callback・helper の変更は報告しない。

### import ルートの確認

これらの形が、値を repository 内の import から受け取っている場合、その import はカタログが登録した公開経路か、注釈が付いた宣言そのものへ解決される必要がある。名前付き import、namespace import、dynamic import、`require`、TypeScript の import-equals、named type import、`keyof import(...)` のどれでも、解決されない経路を通っていたら報告する。import した object を `Object.keys` へ渡す形も、property name の候補と import route を同時に保つ。添字アクセスや `Set` が値の指紋だけでは候補にならない場合でも、未登録 route である事実は所有者の有無に依存しない。所有者を経由しているように見えて、実は同じ package の別 binding や未登録 subpath だった、という状態を塞ぐため。

公開経路の一致には、package の指定子、export 名、exports field から解決した source path を使う。`@scope/vocabulary` から `ORDER_STATUSES` を公開していても、同じ指定子の `SHADOW_STATUSES` は登録済みにならない。consumer の `paths` が同じ指定子を別 source へ向けた場合も、TypeScript が解決した実体 path と登録済み source path が一致しないため未登録になる。alias export は、公開名が owner の symbol と同じ宣言へ解決される場合だけ、その公開名を登録する。conditional exports は到達可能な runtime target がすべて同じ owner symbol を公開する場合だけ登録し、array fallback は実際の module resolution と同じく最初に解決できる target を使う。

相対指定子と repository 内の absolute 指定子は、import 元から解決したファイルの repository 内 path と、import された名前の両方を owner の宣言 path・binding と完全一致させる。TypeScript の `paths` / `baseUrl` で repository 内へ解決される alias も同じ path・binding 判定へ通す。設定済みの `paths` pattern が未解決なら外部 package へ退避せず未登録 route とする。`.ts` / `.tsx` / `.mts` / `.cts` と対応する JavaScript 拡張子の違いだけを正規化し、同じ suffix を持つ別 directory や `index` module を同一視しない。

相対指定子（`./` / `../`）と `#` から始まる未登録指定子は repository 内の未登録 route として扱う。裸の指定子は、repository の package manifest からカタログが独立に保持した package 名と一致すれば、正規 route に一致しない root・subpath・binding を未登録として扱う。invalid・duplicate・out-of-scope owner によって valid entry が 0 件になっても package identity は失われない。repository package ではない裸の指定子だけが外部 package になる。

### owner の登録と lint 免除

`@canonical-values` が runtime owner を登録する条件は次のとおり。

- production の TypeScript ソースにある module-scope の JSDoc で、canonical tag が 1 つだけ書かれている
- JSDoc の末尾から空白だけを挟み、単一の変数文が続く。行コメント、通常の block comment、nested annotation、間に別コメントや token を挟む形は受理しない
- 変数文は単一の Identifier binding と runtime initializer を持つ。ambient declaration、複数 binding、destructuring、type alias、enum、関数、class、import、re-export、制御文は owner にならない
- concept id は、小文字英数字の語を `-` または `.` でつないだ形に一致する

Oxc parser はコメントと top-level statement の位置関係、binding、各 range を確定し、`typescript-6` の checker は同じ binding の解決済み type から期待値域を導出する。array は numeric index type の literal union、object は property name を値域とする。そのうえで initializer の実行候補を別の CandidateSet として評価し、literal、静的 spread、identifier・import alias、sequence の最終値、到達可能な conditional、静的に解決できる call の全結果が期待値域と一致する場合だけ登録する。型 assertion や明示型だけで狭めた opaque call、ambient call、unknown branch は登録しない。empty、非 literal domain、直接記述された重複値も登録しない。

owner は readonly 型を持ち、initializer の実行結果も checker の値域と一致しなければならない。repository 内で実行され得る code から、alias、論理式、分割代入、callback、言語 protocol、container、引数、`call` / `apply` / `bind` を介して同じ object を変更できる場合は登録しない。未解析の呼び出しが mutable parameter で owner を受け取る場合も登録しない。canonical primitive の配列を複製した別配列の変更と、標準 API による列挙・判定・文字列化は owner の変更に含めないが、copy の要素が owner object 自体なら同一性を追跡する。標準 API として受理するには default library symbol の一致に加え、呼び出し前に global binding・static member・prototype member が変更されていないことも必要であり、直接代入と標準 property mutation API のどちらで変更しても owner は登録しない。

initializer の値域を供給できるのは、initializer 自身、登録に成功した repository 内の別 owner、repository 内の JSON source だけである。未登録の TypeScript binding、`node_modules`、production 対象外 source、repository 外の実体を持つ symbolic link は owner の参照元にならない。repository の解析 input に外へ出る symbolic link があれば、strict analysis と cache のどちらも entry を作らない。

lint の免除は、カタログ entry の宣言 path、annotation・binding・declaration の各 offset、concept id、binding が、現在 lint している source を再走査した declaration identity とすべて一致する場合に限る。宣言側ルールは、型 assertion、`satisfies`、括弧、non-null assertion を外した initializer の span と検出した有限値集合の span が完全一致し、fingerprint も entry と一致するときだけ免除する。消費側ルールは、entry の canonical domain に属し、object owner の直接 property key か静的 object spread 内の key、または array owner の実結果を供給する element であるリテラルだけを免除する。array の実結果には透明な式の値側、sequence の末尾、conditional の両結果枝、静的 array spread を含む。property value、捨てられる sequence 式、型 assertion の型、call argument は、同じ initializer 内で owner と同じ値を綴っても免除しない。2 本の lint rule は同じ catalog instance と initializer 解決を共有する。不正な注釈、値域を導出できない宣言、重複 concept、production 対象外の注釈、別 path・別 binding は entry を持たず、どちらのルールにも免除を作らない。

lint は問題のある候補だけを除外した versioned cache の catalog を使う。`dont-review-it verify` と `equivalent-concepts` は cache を使わず repository 全体を strict に解析する。不正注釈と production 対象外の注釈は problem になり、duplicate concept は衝突した全 declaration を catalog から除外したうえで problem になる。

### 依存パッケージが所有する語彙の提示

カタログに所有者が見つからなかったとき、報告の直前に限り、lint 対象ファイルが属するパッケージの直接依存の公開型を調べる。ローカルに書かれた値をすべて admit するリテラルのユニオン型があれば、そのパッケージ名と型名を所有者として報告に載せる。

- 調べるのは、そのファイルが属するパッケージの `dependencies` / `devDependencies` / `peerDependencies` に直接書かれたものだけ。推移的な依存は見ない。名指しできるのは、そのファイルが実際に import できる公開 API に限られるため
- `workspace:` で指定されたリポジトリ内のパッケージは対象外。リポジトリ内の所有者はカタログが受け持つ
- ライブラリ側の型がローカルの値より広いときは、余分に admit する値を報告に並べて絞り込みを促す。リテラルでないメンバ（`number` など）を含む場合はその事実を書く
- 同じ型宣言に別名で届く候補は 1 つに畳む。畳んだうえで残った複数の候補は、順序で優劣を示さず全て並べる
- この照会は報告を出そうとする経路に入ったときだけ走り、プロセス内で 1 度だけ型チェッカを起動する

型情報は「何を報告するか」ではなく「報告に何を書くか」にしか使わない。カタログに所有者がいる場合の報告は変わらず、指紋の一致を条件とする 2 つの形は依存パッケージが所有していても報告しない。報告される箇所の集合は、この仕組みが無かったときと同じ。

型チェッカを起動できない環境（プラットフォームのバイナリが無い、依存が刈り込まれている）では語彙索引を空として扱い、所有者を名指ししない報告に退避する。lint はここで落ちない。

判断の記録は [EDR 0008](../../../../docs/engineering-decision-logs/0008-read-library-types-for-messages-only.md) にある。

### 判定の細部

- 値が 2 個未満なら語彙とみなさない
- `null` は語彙の値として数える。`undefined` は対応する canonical value を持たないので数に入れない
- 真偽値の両方を並べただけの形（`true | false`）は語彙とみなさない
- 置換を持たないテンプレートリテラル（`` `draft` ``）は、引用符で書いた綴りと同じ値として扱う
- 有限の primitive だけから静的に確定する式は JavaScript と同じ値として扱う。加算・文字列連結に加え、減算・乗算・除算・剰余・累乗・shift・bitwise、単項演算、template interpolation を共通 resolver で評価する。例外になる BigInt の混在とゼロ除算は unknown のまま保持する
- `String` の `concat` / `slice` / `raw` / `fromCharCode` / `fromCodePoint`、array の `join`、`Number` / `String` / `Boolean` / `BigInt`、`parseInt` / `parseFloat`、静的な `Math` メソッドも同じ resolver を使う。binding、property、分割代入、`bind` / `call` / `apply` / `Reflect.apply` を経由しても組み立てた値を失わず、同名の local binding が標準 global を shadow した場合は標準処理として扱わない
- 値と import identity は使用箇所の字句 scope から辿る。同名の import・owner binding を関数引数や内側の変数が shadow した場合は、綴りではなく実際に参照された binding を解決する。静的に確定できる alias chain、分割代入、object member・spread、computed key、scalar alias、単純代入を途中に置いても定義元を失わない
- binding、property、呼び出し、型 alias は source 全体を先に索引化してから sink を評価する。前方参照や関数境界を source offset だけで決めず、同じ execution context、実際に到達する call site、静的な guard を候補に反映する。別関数に書かれているだけで呼び出されない write は現在値を上書きしない
- default library の timer・microtask・Promise・collection callback は `call` / `apply` / `bind` と alias を通っても実行到達性を保つ。解析対象外の外部 package callable に渡した function 引数は、保存だけか実行されるかを証明できないため unknown execution として fail-closed に扱う。外部 package を import しただけの値を局所値域とみなすわけではない
- 候補集合は、分かっている候補と「それですべてか」を分けて持つ。unknown property・computed key・spread が混じっても、既知の property name、既知の property value、未登録 route は消さず open な集合として保持する。スキーマ呼び出しのように構文自体が語彙の定義だと確定する sink は、open な集合でも既知の局所候補を報告する。`keyof`、添字アクセス、`Set` のように閉じた局所値域またはカタログ fingerprint を必要とする sink は、open な局所候補だけでは報告しない。未登録 route は完全性や fingerprint にかかわらず報告する
- カタログに登録された runtime owner の initializer そのものだけは、検出した有限値集合の span と fingerprint が entry に完全一致する場合に対象外。宣言 range 全体は免除せず、注釈を書いただけでも免除しない
- ファイル名に `.fixture.` / `.mock.` / `.test.` / `.spec.` / `.stories.` / `.story.` の区切りを含むもの、`__fixtures__` / `__mocks__` / `__stories__` / `__tests__` / `.cache` / `.local-agents` / `coverage` / `dist` / `dist-ssr` / `fixtures` / `test` / `tests` ディレクトリの配下は production のソースではないので対象外。この判定は [no-strict-canonical-literal-use--use-canonical-import](./no-strict-canonical-literal-use--use-canonical-import.md) と同じものを使う。production source が Git から見える対象外 module を import する境界は no-strict 側が報告するが、`git check-ignore` が除外する未追跡 source は repository の供給元として取り込まない
- 同じ構文要素が複数の形で拾われても、報告は 1 箇所につき 1 回
- カタログの走査根は、lint の実行ディレクトリから上に辿って決める。`pnpm-workspace.yaml` か `workspaces` を持つ `package.json` が最初に見つかった場所が根になり、見つからなければ実行ディレクトリ自身を根にする。パッケージのディレクトリから lint を走らせても、リポジトリ全体から走らせたときと同じ語彙を見る

### 対象にならないもの

有限の型を定義しない一般の配列、表示順を表す配列、静的な候補を一つも取り出せない実行時の集合、外部パッケージからの import、閉じた property name 集合を持たない `keyof`、広い合併型、構造を持つ判別可能合併、既にカタログの配列から導出されている型。

プロパティ・引数・戻り値の位置に直接書かれた合併も対象外。このルールが見るのは型エイリアスの宣言だけで、合併型そのものを見ないため、これらは文法上そもそも入ってこない。ただし宣言側の文法から外れた使用箇所は [no-strict-canonical-literal-use--use-canonical-import](./no-strict-canonical-literal-use--use-canonical-import.md) が捕まえる。片方だけでは穴が残るので、2 本で 1 組になっている。

## なぜそれが要るか

同じ値集合が 2 箇所で独立に書かれると、片方だけ変わっても何も落ちない。テストは通り、型検査も通る。壊れたことが分かるのは、実行時に片方の綴りが相手に届かなくなったときで、そこには元の 2 箇所を結ぶ手掛かりが残っていない。

だから語彙はリポジトリのどこか 1 箇所で宣言され、他の全箇所はそこから導出する。スキーマも、型も、所属判定も、同じ実行時の値から出す。そうすれば値を 1 つ足す変更が 1 箇所で済み、足し忘れた箇所は型が落とす。

このルールが報告だけで自動修正を持たないのは、値が一致することが同じ概念であることの証明にならないから。同じ綴りが別々の概念に属することがあり、部分集合に変わっても同じ所有者に属し続けることがある。安全に置換するには、所有者の公開経路が 1 つに定まっていること、局所の束縛名が衝突しないこと、周囲の構文を保てることが要る。どれも機械が決定的には導けない。だから機械は候補を出すところまでで止め、どの所有者に属するかは人が決める。

## どう直すか

所有者を選ぶ前に、設計記録とソースを調べる。行き先は 3 つある。

報告に挙がったリポジトリ内の候補が、同じ概念・同じ変更理由・同じ境界を持つなら、局所の値を消してその公開 API を使う。スキーマも型も所属判定も、import した配列から導出する。候補が複数並んだときは、周囲の振る舞いと所有の境界で選ぶ。報告に並んだ順序で選ばない。綴りが同じことを理由に選ばない。

依存パッケージの公開型が名指しされたなら、その型から導出する。リポジトリ側は所有者を名乗らない。ライブラリ側が余分な値を admit しているなら、`Extract` や `Exclude` で必要な値まで絞り込む。こうしておくと、上流がその語彙を変えたときに宣言がコンパイルエラーになり、気づく契機が残る。

```ts
import type { AllowWarnDeny } from "oxlint";

export type LintRuleSeverity = Extract<AllowWarnDeny, "error" | "warn" | "off">;
```

どちらの候補も無いなら、その概念を所有するべき場所に実行時の値を登録して、そこから全部を導出する。どこにも属さない概念が現れたら、任意の消費者に所有権を押し付けるのではなく、その概念を所有する新しい場所を作る。

import ルートが未登録だと報告された場合は、参照先のファイルに注釈を付けて所有者として登録するか、既に登録されている所有者の公開経路に import を張り替える。

## 禁じる回避策

- 語彙を別の構文へ書き換えて、このルールが見ている文法から逃れる。値集合が 2 箇所にある状態は変わらず、消費側のルールが同じ値を使用箇所で捕まえる
- 所有者を経由しない import ルートを新しく作る。1 段挟んで見かけ上は外部から受け取っている形にしても、import ルートの確認で報告される
- 語彙ごとの opt-out、ワークスペースごとの除外、所有者側の除外タグ。どれも用意しない。過去に存在した除外用のタグと、2 本の canonical rule を対象にした `eslint-disable` / `oxlint-disable` directive は、検証エントリポイントが明示的に拒否する。抑制の口を 1 つでも残すと「面倒だから除外」が積み上がって、語彙の一元化そのものが崩れる

## オプション

`ownershipPolicy`（文字列、省略可）を取る。

このパッケージは「どの語彙をどこが所有すべきか」の内容を持たない。所有権の割り当て方針は利用側が決めるものなので、方針を表す文字列を設定として受け取り、報告メッセージの末尾にそのまま載せる。方針の例としては、サービス全体の運用語彙・API の通信プロトコル・アプリ固有の状態、といった区分が置かれる。

未設定のときは、方針が設定されていないことを報告に書く。報告を受けた人が、方針を決めるところから始める必要があると分かるようにするため。
