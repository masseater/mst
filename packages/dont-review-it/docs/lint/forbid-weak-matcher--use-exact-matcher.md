# forbid-weak-matcher--use-exact-matcher

## 何を検出するか

仕様ファイル（既定では `.test.ts` / `.test.tsx` で終わるファイル）に書かれた、次の 3 つの形。報告は matcher の名前の位置に 1 件ずつ出る。

**弱い matcher の呼び出し。** `expect(...)` を根とするチェーンの末尾に置かれた、禁止集合の matcher。

**非対称マッチャの呼び出し。** `expect.<名前>(...)`。expected 引数の内側かどうかは見ず、書かれた場所そのものを見る。

**完全一致の言い換え。** `toBeNull()` / `toBeUndefined()` / `toBeNaN()`。値そのものとの比較を別の綴りで書いたもの。

### 起点の判定

チェーンの根が `expect(...)` の呼び出しに解決できるものだけを対象にする。`not` / `resolves` / `rejects` は剥いでから根を見るので、修飾子を挟んでも同じ扱いになる。`expect.soft(...)` と `expect.poll(...)` も同じ根として扱う。

型アサーション・非 null アサーション・括弧・オプショナルチェーン・`await` は剥いでから判定する。包みを一枚被せるだけで検出を外せないようにするためである。

プロパティ名は静的に決まるものだけ解決する。識別子、文字列リテラル、式を含まないテンプレートリテラルの 3 つで、`expect(subject)['toBeTruthy']()` も ``expect(subject)[`toBeTruthy`]()`` も同じ名前に解決する。

### 禁止集合

集合は共有の matcher 語彙（`src/lint/oxlint/lib/spec-syntax/matcher-vocabulary.ts`）が持ち、このルールはそれをそのまま読む。

| 系統 | 名前 | 未検証のまま残るもの |
| --- | --- | --- |
| truthiness | `toBeTruthy` / `toBeFalsy` / `toBeDefined` / `toBeNullable` | 真偽に潰れる前の値そのもの |
| loose-structure | `toEqual` | プロパティの不在と `undefined` の別、生成元のクラス |
| partial-shape | `toMatchObject` / `toHaveProperty` / `toHaveLength` | 期待側が名指ししなかったもの全部 |
| containment | `toContain` / `toContainEqual` / `toMatch` | 含まれていた部分の外側全部 |
| runtime-type | `toBeInstanceOf` / `toBeTypeOf` / `toSatisfy` / `toBeOneOf` | 型や述語を通過する多くの値のうちどれか |
| magnitude | `toBeGreaterThan` / `toBeGreaterThanOrEqual` / `toBeLessThan` / `toBeLessThanOrEqual` / `toBeCloseTo` | 境界の向こう側にある多くの数のうちどれか |
| thrown-value | `toThrow` / `toThrowError` | 投げられた値そのもの |

各エントリは「通っても未検証のまま残る領域」を 1 文で持っていて、その文がそのまま報告本文に載る。この 1 文を書けない名前は集合に載せない。名前だけを禁じても、書き手は代わりに何を書けばよいか決められないからである。

非対称マッチャの側は `anything` / `any` / `schemaMatching` / `toSatisfy` / `toBeOneOf` / `objectContaining` / `arrayContaining` / `stringContaining` / `stringMatching` / `closeTo`。オブジェクトリテラルや配列リテラルの奥、非対称マッチャの入れ子の中、そして一度変数に束ねた初期化子も、すべて同じように当たる。深さは見ていない。

完全一致の言い換えは、語彙の「冗長な綴り」のうち書き換え先が完全一致 matcher（`toBe`）であるものだけを取る。`toBeCalled` → `toHaveBeenCalled()` のような旧綴りは書き換え先が完全一致ではないので、この判定から構造的に外れる。

### 意図的に広げていない範囲

| 形 | 対象にしない理由 |
| --- | --- |
| `expect(x).toBe(1)` / `expect(x).toStrictEqual({})` | このルールが残そうとしている形そのもの |
| `expect(save).toHaveBeenCalledWith({ id: 1 })` | 「どう呼ばれたか」の表明であって、値の比較ではない |
| `expect(save).toHaveReturnedWith(1)` | 返り値の記録を見る形。担当が別 |
| `expect(x).toMatchSnapshot()` | 記録との照合。snapshot の担当が別にいる |
| `expect(save).toBeCalled()` | 呼び出し表明の旧綴り。綴りの統一は別の関心事 |
| `expect(x).toBeSettled()` | 禁止集合に無い名前。弱さを意味論から推論しない |
| `report.toContain(entry)` | 根が `expect` チェーンでない。同名メソッドを持つだけの受け手は巻き込まない |
| `runner.soft(x).toBeTruthy()` | 派生した入口と同じ綴りでも、受け手が `expect` でなければ根にならない |
| `makeExpect()(x).toBeTruthy()` | 入口を別の呼び出しが返している形。根が識別子まで届かない |
| `expect(x)[matcherName]()` | 名前が実行時にしか決まらない。解決できないものを推測しない |
| `expect(x).toBeTruthy()`（仕様ファイルの外） | 仕様ファイルの外では `expect` は何を指す名前でもありうる |

### 届かない範囲

起点は `expect` という綴りで判定している。仕様ファイルの中で `expect` を別のものに束縛し直した場合、その位置は依然として起点として扱われる。逆に別名で import した入口は起点として扱われない。束縛の出所から起点を解決する仕組みは、この群の共通土台に入った時点でこのルールもそこへ載せ替える。

非対称マッチャを別ファイルの定数に束ねた形にも届かない。同じファイルの中であれば、束縛の初期化子がそのまま `expect.<名前>(...)` の呼び出しなので、宣言の位置で当たる。

## なぜそれが要るか

守っている不変条件は「アサーションが通ったなら、値と形の全体が期待どおりである」ことである。

弱い matcher はこれを満たさない。見ているのは subject の射影だからである。真偽だけを見る matcher は、意図した値が別の値に退行しても通る。部分オブジェクト一致は、意図しないフィールドが増えても通る。外に出てはいけない値が混ざったオブジェクトが、そのまま素通りする。部分文字列一致は、前後に余計な文字列が付いても通る。

壊れ方は 2 層ある。

1 層目は、そのアサーションが主張していないことである。`toBeTruthy` が主張しているのは「真に潰れる何かだった」であって、ケース名が言っている「この値を返す」ではない。名前が主張している検査は行われていない。

2 層目は、行われていないことが green として現れることである。green の意味が「コードが生んだ値が期待した値と形にちょうど一致した」から「一部だけ一致した」に薄まる。そして薄まった分は報告に出ない。人が見るのは通った件数であり、各アサーションがどこまでを固定したかではない。落ちるはずのケースが落ちないことに気づくのは、本番で壊れたあとにテストを読み直したときである。

意味が薄まると、この束の他のルールが守っているものも一緒に失効する。subject の出所を締めても、fixture の準備を締めても、最後に「一部だけ一致」で通してよいなら、締めた分は緑の意味に反映されない。

「完全一致にできない事情がある」という反論はたいてい動的な値を指している。時刻・乱数・生成 ID である。それは matcher を緩める理由ではなく、seam を作る理由になる。matcher を緩めるのは安い手段ではなく、別のアサーションに差し替える操作である。

## どう直すか

**プリミティブ 1 つ、あるいは同一性なら、値そのものと比較する。**

```ts
expect(specStemOf("src/order.test.ts", DEFAULT_SPEC_FILE_SUFFIXES)).toBe("order");
expect(UNVERIFIED_REGION_BY_WEAK_MATCHER.get("toStrictEqual")).toBe(undefined);
```

**構造なら、subject をそのまま完全一致で比較する。** 期待側には、コードが返すべき値の全体を書く。

```ts
expect(specFileSuffixesFrom([{ specFileSuffixes: [".spec.ts", ".spec.tsx"] }])).toStrictEqual([
  ".spec.ts",
  ".spec.tsx",
]);
```

**動的な値が邪魔なら、その値に seam を作る。** 時刻を引数で受け取る、ID 生成器を差し替えられるようにする、乱数の種を固定する。決定的にしてから完全一致で比較する。外部依存から流れてくる値だけをやむなく狭める場合も、subject の残りは完全一致のまま保つ。

**例外なら、投げられた値そのものを比較する。** 文字列を渡す `toThrow` が主張しているのは「メッセージにその文字列が含まれる」であって「メッセージがその文字列と等しい」ではない。前後に何が付いても通る。

**言い換えは正準の綴りに戻す。** `toBeNull()` は `toBe(null)`、`toBeUndefined()` は `toBe(undefined)`、`toBeNaN()` は `toBe(Number.NaN)`。報告に書き換え先が入っている。

自動修正は持たない。書き換え先が一意に決まるのは言い換えの 3 つだけで、残りは「何と比較すべきか」を書き手が決める必要がある。決められないアサーションは、消すか、検査すべき振る舞いを先に決める。

## 禁じる回避策

- 非対称マッチャを別名に束ねてから使う。束縛の初期化子がその呼び出しなので、宣言の位置で当たる
- 非対称マッチャをオブジェクトや配列の奥に埋めて、expected の見た目を完全一致にする。深さは見ていないので当たる
- 部分一致を、気になるフィールドごとの複数アサーションに割る。誰も名指ししなかったフィールドは未検証のまま残るので、弱いアサーションが断片化しただけになる。しかもフィールド単位のアサーションは `no-expect-projected-subject--use-tostrictequal-on-subject` に当たる
- `expect` の中で subject を組み立てて完全一致にする。subject を `expect` の中で生産することは `no-expect-call-expression--yield-from-fixture` が禁じている。subject は fixture から受け取る
- `expect` の中でメンバを射影して完全一致にする。同じく `no-expect-projected-subject--use-tostrictequal-on-subject` の担当
- 禁止集合の外の matcher に載せ替える。自前の弱い matcher を登録して名前を変えても、比べているものが同じなら未検証の領域は変わらない
- 目の前のアサーションを通すために `allowedMatchers` に名前を足す。1 か所の都合で「このリポジトリでは何を弱いとみなすか」の定義を動かすことになり、他のすべてのアサーションに効く
- 仕様ファイルの接尾辞をずらして範囲の外に出す
- 抑制ディレクティブ

## オプション

`allowedMatchers`（文字列の配列、既定 `[]`）は、報告から外す matcher 名を取る。名前で外すので、弱い matcher・非対称マッチャ・言い換えのどれにも同じように効く。

```jsonc
["error", { "allowedMatchers": ["toContain"] }]
```

`specFileSuffixes`（文字列の配列、既定 `[".test.ts", ".test.tsx"]`）は、このルールが見るファイルの接尾辞を取る。仕様ファイルを見るルールは同じ範囲を共有するので、変えるならこのルールだけでなく同じ範囲を見るルール全部で揃える。

```jsonc
["error", { "specFileSuffixes": [".spec.ts"] }]
```

未知のキーは schema が拒否する（`additionalProperties: false`）。

禁止集合そのものを設定で差し替えることはできない。差し替えを許すと、名前ごとに要る「未検証のまま残る領域」の 1 文を持たない名前が集合に入り、報告からその 1 文が落ちる。1 文を失った報告は「これは弱い」としか言えず、書き手は代替を選べない。集合を狭める方向だけを `allowedMatchers` として開けてある。
