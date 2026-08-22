# no-local-finite-value-set--use-or-register-canonical-values

## 何を検出するか

production の TypeScript source で、string・number・boolean・`null` からなる有限語彙を新しく定義する次の構文を検出する。

- member 名が `enum` または `picklist` の call に渡す静的 scalar array
- scalar literal union の type alias
- member 名が `union` の call に渡す scalar `literal` call の静的 array
- JSON Schema の非 computed `enum` property に渡す静的 scalar array
- catalog fingerprint と一致する静的 `Set` initializer
- catalog fingerprint と一致する `typeof ARRAY[number]`
- named import または `import()` type を参照する `keyof`
- schema call に渡す、静的 object または named import に対する `Object.keys`

schema array は直接記述した配列と、同じ file の module-scope Identifier binding に置いた配列を扱う。`Object.keys` は同じ file の module-scope object binding と named import を扱う。型 assertion、`satisfies`、non-null assertion、括弧は外して値を見る。値が 2 個未満の集合と、`true` / `false` だけの集合は語彙とみなさない。

`Set` と indexed access は一般の局所集合にも現れるため、catalog fingerprint と一致した場合だけ報告する。schema、literal union、JSON Schema は構文自体が有限語彙の定義なので、catalog owner がまだ無くても報告する。

自動修正は持たない。同じ綴りが別概念に属する場合があり、どの owner から導出するかを値だけでは決められないためである。

## 解析の順序

rule は visitor を返す前に source 全体を一度解析する。

1. Oxc AST から module-scope の静的 array・object binding と named import を索引化する
2. source 全体から対象構文を列挙する
3. 局所値域、catalog fingerprint、import route を照合して診断を確定する
4. `Program` visitor は完成済み診断を報告するだけにする

visitor が到着した順に binding state を書き換えない。callback の実行、標準 API の返値、collection mutation、一般の alias chain は評価しない。対象を増やす場合は明示的な syntax contract と耐久テストを追加し、JavaScript 実行系を lint 内に作らない。

## import route の確認

対象構文が named import の binding を受け取る場合、その import は catalog が登録した public route または owner declaration 自身へ解決される必要がある。

public route は次の identity をすべて保持する。

- package specifier
- exported name
- package `exports` が解決した runtime source path

consumer 側も TypeScript module resolution で実体 source を解決する。同じ specifier でも別 export name、別 source、未登録 subpath、`paths` が shadow sourceへ向けた alias は unregistered になる。relative import は実体 pathと imported name を owner declaration path・binding に完全一致させる。

catalog owner と同じ名前の ambient または local binding は、綴りだけで owner と同一視しない。runtime source identity を持たない同名 binding を対象 sink へ渡した場合は unregistered route として報告する。

外部 package は repository route ではないため、この route check の対象外である。

## owner の登録

`@canonical-values` owner は次をすべて満たす必要がある。

- production の TypeScript sourceにある module-scope の JSDocである
- canonical tag は JSDoc 内に1つだけである
- JSDoc の直後に空白だけを挟んで単一 variable statement が続く
- variable statement は単一 Identifier binding と runtime initializerを持つ
- concept id は小文字英数字の語を `-` または `.` でつないだ形である

line comment、通常の block comment、nested annotation、intervening token、ambient declaration、multi-binding、destructuring、type alias、enum、function、class、import、re-export、制御文は owner にならない。

owner 候補は最寄りの TypeScript configuration ごとにまとめ、configuration ごとに1つの `typescript-6` Programを作る。checker が同じ binding に解決した型から値域を導出する。

- array は numeric index type の literal union を値域にする
- object は index signature を持たない閉じた property nameを値域にする
- string、number、boolean、`null`、負数を扱う
- checker が解決できる import と spreadを扱う
- empty、widened domain、scalar、非 literal domain、直接記述された重複値は problem にする

duplicate concept は衝突した全 declaration を catalog から除外する。strict verification は cache を使わず、invalid・duplicate・out-of-scope・値域導出失敗が1件でもあれば失敗する。

## lint 免除

免除は注釈の存在ではなく、catalog entry と現在の source の declaration identity が一致する場合だけ作る。

- repository root からの declaration path
- concept id と binding
- annotation start、binding start、declaration start、declaration end

一致した owner declaration 内の canonical domain だけを免除する。同じ file の declaration 外、別 path、別 binding、古い cache range、不正・duplicate・out-of-scope・値域導出失敗の declaration は免除を持たない。

## Git ignore と production scope

ファイル名に `.fixture.` / `.mock.` / `.test.` / `.spec.` / `.stories.` / `.story.` を含むものと、`__fixtures__` / `__mocks__` / `__stories__` / `__tests__` / `.cache` / `.local-agents` / `coverage` / `dist` / `dist-ssr` / `fixtures` / `test` / `tests` directory 配下は production source ではない。

repository scan と import route 判定は、lint 開始前に `git ls-files --others --ignored --exclude-standard --directory` から作る同じ source scope に従う。Git が除外する未追跡 file、directory、symlink ancestor は catalog input と repository route に取り込まない。すでに tracked の file は後から ignore pattern に一致しても repository source のまま扱う。source scope と catalog は lint process の間は不変であり、visitor や import route lookup から Git と repository scan を再実行しない。

## なぜそれが要るか

同じ有限集合が複数箇所に独立して書かれると、owner だけを変更しても型検査やテストが落ちない。schema、型、membership checkを同じ runtime bindingから導出すれば、語彙変更の供給元を1箇所に固定できる。

owner 候補の値域は TypeScript checker に一任する。Oxc AST から import・spread・public alias の値を独自に評価すると、TypeScript と異なる意味になり、catalog と consumer の間に別の抜け道が生まれる。

## どう直すか

報告に owner が示された場合は、局所の有限集合を削除し、registered public routeから owner bindingを importしてschema・型・membership checkを導出する。

owner が示されない場合は、その概念を所有する production module に runtime valuesを登録し、consumerから参照する。依存 package が語彙を所有する場合は、その公開型またはruntime APIから導出する。

unregistered route の場合は、参照先をownerとして正しく登録するか、すでに登録された public routeへimportを張り替える。

## 禁じる回避策

- 語彙ごとの opt-out、workspaceごとの除外、owner側の除外tagを追加する
- canonical ruleを`eslint-disable` / `oxlint-disable`で抑制する
- ownerと同名のambient bindingを置いてregistered routeに見せる
- 値をGit ignoredの未追跡fileへ移し、repository ownerとして扱わせる

## オプション

`ownershipPolicy` を文字列で受け取る。所有権の割り当て方針を報告メッセージに載せるだけで、検出範囲は変えない。
