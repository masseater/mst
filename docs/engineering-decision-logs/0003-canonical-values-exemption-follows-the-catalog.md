# 0003. 語彙の免除はカタログへの登録に従わせる

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

有限値の語彙は repository 内の 1 つの runtime binding が所有し、型・schema・membership check を含む consumer はその binding から導出する。注釈の存在だけで lint を免除すると、不正な位置の注釈、値域を解決できない宣言、別 binding、古い cache range でも owner を名乗れる。

owner の構文を認識する処理、値域を解決する処理、consumer を検出する処理がそれぞれ別の意味評価器を持つと、import、spread、公開 alias の解釈が分岐する。構文の対応付けは Oxc、解決済みの型と symbol identity は TypeScript に一任し、lint は完成した解析結果だけを使う必要がある。

## 決定

### owner declaration を一つの構文へ限定する

owner として受理するのは、production の TypeScript source にある module-scope の JSDoc `@canonical-values` と、その直後に空白だけを挟んで続く単一 variable statement である。

- JSDoc 内の canonical tag は 1 つだけにする
- variable statement は単一の Identifier binding と runtime initializer を持つ
- concept id は小文字英数字の語を `-` または `.` でつなぐ
- line comment、通常の block comment、nested annotation、intervening token、ambient declaration、multi-binding、destructuring、type alias、enum、function、class、import、re-export、制御文を owner にしない

Oxc parser は comment、top-level statement、binding、annotation・binding・declaration の各 offset を確定する。値域は解釈しない。

### repository を先に TypeScript 解析して catalog を作る

owner 候補を最寄りの TypeScript configuration ごとにまとめ、configuration ごとに 1 つの `typescript-6` Program を作る。checker が同じ binding に解決した型から値域を導出する。

- array は numeric index type の literal union を値域にする
- object は index signature を持たない閉じた property name を値域にする
- string、number、boolean、`null`、負数を扱う
- checker が解決できる import と spread を扱う
- empty、widened domain、scalar、非 literal domain、直接記述された重複値は problem にして entry を作らない

public route は package specifier、export name、`exports` が解決した runtime source path を保持する。checker が解決した export symbol が owner symbol と同じ declaration を指す場合だけ登録し、同名の shadow export や別 source を登録しない。consumer の import は同じ TypeScript module resolution mode で実体 source を解決し、specifier・imported name・source identity が一致する場合だけ registered とする。

repository analysis は declaration、entry、problem を一度に返す。duplicate concept は衝突した全 declaration を catalog から除外する。strict verification は cache を使わず、problem が 1 件でもあれば失敗する。lint は同じ builder の versioned cache を使うが、problem のある declaration を entry にしない。

### consumer は visitor より前に source 全体を解析する

二本の lint rule は `create` 時に Oxc AST 全体を一度索引化し、診断候補を不変な配列として完成させてから visitor を返す。visitor は `Program` で完成済み診断を報告するだけであり、走査順に binding や候補値を書き換えない。

`no-local-finite-value-set--use-or-register-canonical-values` は、語彙を定義する明示的な構文だけを対象にする。

- `enum` / `picklist` member call に渡す静的 scalar array
- scalar literal union の type alias
- `union` member call に渡す scalar `literal` call の静的配列
- JSON Schema の非 computed `enum` property に渡す静的 scalar array
- catalog fingerprint と一致する静的 `Set` initializer
- catalog fingerprint と一致する `typeof ARRAY[number]`
- named import または `import()` type を参照する `keyof`
- schema call に渡す、静的 object または named import に対する `Object.keys`

schema array は直接記述または同一ファイルの module-scope bindingを解決する。`Object.keys` は同一ファイルの module-scope object binding または named importを解決する。named import と `import()` type は TypeScript が解決した exact route を照合する。catalog owner と同名なのに登録 route を持たない ambient・local binding は、綴りだけで owner と同一視せず未登録 route として報告する。

`no-strict-canonical-literal-use--use-canonical-import` は catalog の値を直接綴る string・number・boolean・`null` literal、置換のない template literal、符号付き numeric literal を対象にする。module specifier、構造上の property key、標準 `Pick` / `Omit` の key selector は値の使用箇所ではないため対象外にする。

どちらのルールも JavaScript の一般式、callback の実行、標準 API の返値、collection mutation を評価しない。TypeScript checker と別の実行系を lint 内に作らず、対象構文を増やす場合は新しい明示的な syntax contract と耐久テストを追加する。

### 免除を現在の declaration identity に限定する

免除 range を作る前に現在の source を再走査し、次を catalog entry と完全一致させる。

- repository root からの declaration path
- concept id と binding
- annotation start、binding start、declaration start、declaration end

一致した declaration range のうち、entry の canonical domain に属する値だけを二本の rule から免除する。同じファイルの declaration 外、別 path、別 binding、現在の source と一致しない cache entry、不正・duplicate・out-of-scope・値域導出失敗の declaration は免除を持たない。

### Git が除外する未追跡 source を repository 境界へ取り込まない

repository scan と import route 判定は、lint 開始前に `git ls-files --others --ignored --exclude-standard --directory -z` で確定した source scope を共有する。Git が除外する未追跡 file、directory、symlink ancestor は catalog input と repository route から除外する。すでに index に登録された file は後から ignore pattern に一致しても repository source のままなので除外しない。

source scope、repository file 一覧、catalog、TypeScript の解決結果は visitor の開始前に一度だけ作り、lint process の間は不変にする。repository の字面 path と real path を正規化し、ignored symlink 配下は symlink 自身の字面 path で除外する。visitor と import route lookup から Git command、repository scan、cache fingerprint の再計算を呼ばない。

## 影響

注釈を書くだけでは lint を止められない。catalog entry を作れた現在の declaration identity だけが免除を持ち、strict verification は不正候補を problem として返す。

owner の値域と public symbol identity は TypeScript checker の結果に従う。Oxc AST から import・spread・alias export の値を再帰評価する経路は持たない。

consumer の判定は source offset 順の可変状態に依存しない。全候補が visitor 登録前に確定するため、前方参照や visitor の呼び出し順で結果が変わらない。

## 検討して採らなかった案

**注釈が見つかった statement をそのまま免除する。** catalog entry を作れない注釈でも lint を止められる。

**concept id と file path だけを照合する。** 同じ file 内の別 declaration と source edit 後の古い range を区別できない。

**Oxc AST の initializer を再帰走査して値を導出する。** TypeScript が解決する import・spread・alias・literal type と別の評価器になり、両者の結果がずれる。

**rule visitor が到着した順に binding state を更新する。** sink と write の走査順が解析結果を決め、構文を増やすたびに JavaScript 実行系の再実装へ膨張する。

**Git ignore を path pattern だけで再実装する。** tracked file と untracked file を区別できず、Git が repository source とみなす集合とずれる。
