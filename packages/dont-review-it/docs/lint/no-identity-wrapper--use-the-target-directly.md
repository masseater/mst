# no-identity-wrapper--use-the-target-directly

## 何を検出するか

名前を持つ関数のうち、次の 3 つを同時に満たすもの。

1. 本体が 1 つの呼び出し式または構築式だけでできている
2. その呼び出しまたは構築の実引数が、自分の仮引数と同じ順序・同じ個数・同じ名前で並んでいる
3. 自分の境界に戻り値の型契約を宣言していない

「名前を持つ関数」は 2 通りに限る。`function` 宣言と、識別子への代入（`const forward = (input) => target(input);`、`const forward = function (input) { return target(input); };`）である。オブジェクトのプロパティ、クラスのメソッド、呼び出しの引数に直接書いたコールバックは対象にしない。これは検出できないからではなく、意図的に外している（後述）。

本体として認めるのは 2 つの形である。式本体のアロー関数（`(a) => f(a)`、`(a) => new C(a)`）と、`return` 文 1 つだけからなるブロック（`(a) => { return f(a); }`、`(a) => { return new C(a); }`）。文が 2 つ以上あれば、この関数は転送以外のこともしている。

引数の一致は名前で見る。`(a, b) => f(a, b)` と `(a, b) => new C(a, b)` は一致し、`(a, b) => f(b, a)` は一致しない。TypeScript の `this` pseudo-parameter は emit されないので実行時の引数個数には数えない。残余引数の展開（`(...args) => f(...args)`、`(...args) => new C(...args)`）は一致として扱う。仮引数が 0 個で実引数も 0 個のとき（`() => start()`、`() => new C()`）も一致である。同じ処理に別の名前を与えている点は変わらない。

固定された target の形は問わない。識別子（`f(a)`、`new C(a)`）でもメンバー参照（`parser.parse(a)`、`new parsers.C(a)`）でも同じく報告する。ただし target を選ぶ式のどこかが仮引数、関数自身の束縛、wrapper の実行 context に属する `this`、`super` に依存する場合は固定 target ではない。`handlers[key](key)`、`getHandler(key).run(key)`、再帰呼び出し、`this.handle(value)`、method 内の arrow wrapper が呼ぶ `super.handle(value)` は報告しない。target 式の内側にある通常の `function` は自分の `this` を持つため、その内側の `this` は wrapper の実行 context への依存として扱わない。

target が `arguments`、`new.target`、direct eval に依存する場合も報告しない。wrapper の呼び出しを target 式へ置き換えると、引数個数、construct 呼び出しかどうか、lexical scope が変わるためである。`eval!`、`eval as typeof eval`、`eval satisfies typeof eval`、`<typeof eval>eval` の TypeScript wrapper は emit 時に消えるため direct eval として扱う。`import.meta` は module 内で固定された context なので、この除外には含めない。shadow された通常関数としての `eval` も direct eval ではない。

target が仮引数自身、または仮引数を根に持つメンバー参照なら報告しない。`(run) => run(run)`、`(service) => service.run(service)`、`(C) => new C(C)`、`(registry) => new registry.C(registry)` は、固定 target に別名を与えるのではなく、渡された関数、object、constructor を適用している。

さらに、束縛の参照を同じファイルの scope で解決し、1 件以上の参照があり、そのすべてが同じ引数個数の直接呼び出しである場合だけ報告する。callback として渡す、値として代入する、export する、余分な実引数を捨てる、足りない実引数を `undefined` として target へ渡す、といった使い方には target への単純置換が成立しないため報告しない。参照が無い関数は、呼び出し箇所で target を使う修正が存在せず、未使用宣言の検査が削除を担当する。残余引数だけを転送する関数は呼び出し時の個数をそのまま保つため、直接呼び出しなら対象になる。

### 戻り値の型契約を宣言しているものは通す

次のいずれかがあれば、この関数は自分の境界で「何を返すか」を宣言している。値が素通しであっても報告しない。

- 関数自身の戻り値型注釈（`const parse = (input: string): User => read(input);`）
- 代入先の束縛の型注釈（`const parse: ParseUser = (input) => read(input);`）
- 関数自身の型引数宣言（`const parse = <Parsed>(input) => read(input);`）
- 転送する呼び出しまたは構築への型引数（`const parse = (input) => read<User>(input);`、`const parse = (input) => new Parser<User>(input);`）

仮引数の型注釈は含めない。`noImplicitAny` の下では仮引数の注釈は事実上必須なので、これを契約の宣言とみなすとルールが何も報告しなくなる。任意に書ける戻り値側の宣言だけが、書き手の判断としての意味を持つ。

このルールは「宣言された型が呼び先の型より本当に狭いか」を確かめない。型の関係を見るには型検査器の結果が要り、このルール群は構文だけで判定する土台の上にある（[EDR 0004](../../../../docs/engineering-decision-logs/0004-shape-the-lint-rule-foundation-around-tooling-limits.md)）。したがって判定は「境界に戻り値の契約が書かれているか」で行い、狭めていない広い注釈を足して報告を消す書き方は「禁じる回避策」で塞ぐ。

### export と overload をどう扱うか

export された関数は、同じファイルの外に列挙できない呼び出し箇所を持つため報告しない。宣言と export が別の文に分かれていても、export specifier を束縛の参照として解決して対象外にする。

overload signature が同じ名前に付いている実装も報告しない。実装本体が値を転送するだけでも、複数の signature はその名前が持つ型契約であり、実装だけを target へ置き換えると契約が消える。

別名で同じ定義を公開するだけなら、転送関数ではなく再 export を使える。

```ts
export { parseUser } from "./parse-user.ts";
export { parseUser as parse } from "./parse-user.ts";
```

このルールは open な export を誤って直接置換しない。export された転送関数が本当に不要か、再 export にできるかは、利用側を含む別の check が扱う範囲である。

### インラインのコールバックを外している理由

`inputs.map((input) => parse(input))` と `inputs.map((input) => new Parser(input))` を報告しないのは、target を直接渡す直し方が正しくないからである。`inputs.map(parse)` は追加の引数を渡し、`inputs.map(Parser)` は constructor を通常の関数として呼ぶ。「target を直接使え」という直し方が成立しない場所で報告すると、指示に従った結果が壊れる。

同じ理由で、`async` と generator も外している。`async (a) => f(a)` は `f` と同じ関数ではない。同期的に投げられる失敗が拒否された Promise に変わる。generator も戻り値の契約が列に変わる。どちらも `f` を直接呼ぶ形には置き換えられない。

## なぜそれが要るか

守っている不変条件は「1 つの動作には 1 つの名前が対応する」ことである。

呼び出しまたは構築を転送するだけの関数はこの対応を 1 対 2 にする。同じ動作に 2 つの名前が付き、しかも片方は中身を持たない。

読み手側で壊れるものは 3 つある。定義へ辿る作業が 1 段増える。名前を引いた読み手が得るのは「別の名前がある」という情報だけで、動作は次の階層にある。次に、呼び先の名前で検索したときに、この関数を経由した呼び出しが結果に出ない。影響範囲の把握が、検索 1 回では終わらなくなる。最後に、2 つの名前は独立に変えられるので、片方をリネームしてももう片方は無傷のまま残り、名前どうしの対応が静かにずれる。

書き手側では、この関数が「後で何かを足す場所」として置かれることが多い。足されるまでの間、その場所は空である。空の抽象は、実際に何かを足す段になっても役に立たない。何を足すかが決まったときに必要な引数や戻り値は、置いた時点の 1 対 1 の形とは違うのが普通だからである。

一方で、値が素通しでも意味を持つ形がある。呼び先の型が広く、その広さがこのモジュールにとって正しくないとき、狭い型を宣言した束縛を置くのは、動作ではなく語彙を足す行為である。素通しであることは形の問題であって、そこで何が宣言されているかとは別である。だからこのルールは、境界に戻り値の契約があるかどうかで両者を分ける。

## どう直すか

**target を直接使う。** 同じファイルで解決できた転送関数の呼び出し箇所を target の呼び出しまたは構築に置き換え、関数を消す。ルールは引数個数が保たれる直接呼び出しだけを対象にする。

置換では、wrapper 呼び出しが持っていた評価順と lexical binding を保つ。元の呼び出しは wrapper の実引数を左から右へ評価し終えてから、wrapper 本体で target を評価する。target 式をそのまま外側へ出すと target が実引数より先に評価されるため、どちらかに getter、関数呼び出し、代入などの観測可能な処理がある場合は意味が変わる。実引数を左から右へ一時束縛へ評価してから、その一時束縛を使って target を呼び出すか構築する。

target 式が外側の束縛を参照し、呼び出し箇所に同名の別束縛がある場合、そのままコピーすると参照先が変わる。先に呼び出し箇所の shadowing binding を alpha-rename し、target が wrapper の位置で参照していた binding を保ってから置換する。

```ts
const parsed = parse(input);
const parser = new Parser(input);
```

```ts
const input = readInput();
const parsed = getParser().parse(input);
```

**名前を変えて公開したかった場合、再エクスポートにする。**

```ts
export { parse as parseUser } from "./parse.ts";
```

**呼び先の型が広すぎたのが理由なら、狭い型を宣言する。** 戻り値型注釈か、束縛の型注釈を書く。宣言した型が本当に狭いなら、その宣言はこのモジュールの語彙になる。

```ts
const scopeAt: ScopeLookup = (node) => context.sourceCode.getScope(node);
```

**受け手の形に合わせるためだった場合、呼び先の側を直す。** 引数の順序や個数が合わないから包んでいるのであれば、それは転送ではなく変形であり、このルールには当たらない。当たっているということは、形は既に合っている。

自動修正は持たない。target を直接使う、再エクスポートにする、狭い型契約を宣言する、のどれが正しいかは構文だけでは一つに定まらない。

## 違反にならないもの

- 引数を変形して渡す形。定数を足す（`(a) => f(a, DEFAULT)`）、値を取り出す（`(a) => f(a.id)`）、順序を変える（`(a, b) => f(b, a)`）、個数を減らす（`(a, b) => f(a)`）。これらは部分適用であり、別の関心事である
- 呼び出しまたは構築以外を含む本体。文が 2 つ以上あるもの、省略可能呼び出し（`f?.(a)`）
- 分割代入や既定値を持つ仮引数。値を取り出す・補う処理が入っている
- 仮引数そのもの、または仮引数を根に持つメンバーを呼び出し target にする形。渡された関数や object を適用しているのであって、固定 target へ転送しているのではない
- 仮引数そのもの、または仮引数を根に持つメンバーを構築 target にする形。渡された constructor を適用しているのであって、固定 target へ転送しているのではない
- `async` 関数と generator
- オブジェクトのプロパティ、クラスのメソッド、インラインのコールバック
- callback、値、export として参照される名前付き関数
- optional call で参照される名前付き関数。常に存在する wrapper と存在しない可能性がある target では optional call の意味が変わる
- 同じファイルに直接呼び出しが 1 件も無い名前付き関数。未使用宣言の検査が削除を担当する
- target を選ぶ式が仮引数、関数自身、`this`、`super` に依存する関数
- target を選ぶ式が `arguments`、`new.target`、unshadowed direct eval に依存する関数
- overload signature を持つ関数実装

## 禁じる回避策

- 狭めていない戻り値型注釈を足して報告を消す。`(input) => read(input)` に `: ReturnType<typeof read>` や、呼び先の戻り値そのままの型を書いても、この関数が何も宣言していない事実は変わらない。このルールは型の関係を確かめないので報告は消えるが、消える理由は検査の限界であって、書き方が正当になったからではない
- 束縛に呼び先と同じ型の別名を付ける。型エイリアスの名前が増えるだけで、契約は 1 ミリも狭まっていない
- 本体に無意味な文を足して「1 文だけ」の条件から外す。転送以外のことをしていない以上、増えたのは行数だけである
- 引数名を変えて一致判定から外す（`(source) => parse(source)` を `(source) => parse(source as string)` にするなど）。判定は名前の一致で行っているので変え方によっては報告が消えるが、その関数がしていることは変わらない。型アサーションを足した場合は `no-double-type-assertion--declare-the-real-type` の対象にもなる
- 転送関数をオブジェクトのプロパティやクラスのメソッドに移して対象から外す。名前を持つ束縛だけを見ているのは、直し方が成立する範囲に判定を限るためであって、それらの位置なら書いてよいという意味ではない
- `async` を足して対象から外す。呼び先が同期関数なら、`async` を足した時点で呼び出し側は `await` を書くことになり、失敗の伝わり方も変わる。報告を消すためだけに契約を変えるのは、この関数を残す理由にならない
- 抑制ディレクティブ

## オプション

取らない。有効か無効かだけを設定側で決める。
