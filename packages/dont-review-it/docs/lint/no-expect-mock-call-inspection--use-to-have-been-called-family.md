# no-expect-mock-call-inspection--use-to-have-been-called-family

## 何を検出するか

テスト宣言ファイルの中で、モックの「呼び出し記録」が値として 2 か所のいずれかに現れる形。

1. **アサーションの受け手。** `expect(受け手).<matcher>(...)` の受け手が呼び出し記録に行き着くもの
2. **fixture が返す subject。** fixture が返す式が呼び出し記録に行き着くもの

呼び出し記録とみなすのは、モック名前空間プロパティ `mock` の直下にある「どう呼ばれたか」のプロパティである。既定値は `calls` / `contexts` / `instances` / `invocationCallOrder` / `lastCall` の 5 つ。

matcher の集合は持たない。受け手が呼び出し記録に行き着くかどうかだけで判定する。`toHaveBeenCalled*` 系は受け手がモック束縛そのものになるため、集合を持たなくても構造的に外れる。

### 記録に行き着くかの辿り方

`mock` とその直下のプロパティという隣接した 2 段が、アクセス連鎖のどこかに現れれば記録とみなす。派生形はその先に何段重なっても記録のままである。

- 添字アクセス（`sendMail.mock.calls[0][0]`）
- 長さ（`sendMail.mock.calls.length`）
- 写像（`sendMail.mock.calls.map((call) => call[0])`）
- 型アサーション・非 null アサーション・括弧・オプショナルチェーン・`await` の包み

識別子は、束縛の出所まで辿る。辿る条件と深さはアサーション側と fixture 側で同じものを使う。

- 中間変数への束縛
- 分割代入での取り出し（`const { calls } = sendMail.mock;`、`const [first] = sendMail.mock.calls;`）
- 名前空間そのものの取り出し（`const { mock } = sendMail;`）
- 多段の転送（`const record = sendMail.mock; const sent = record.calls;`）
- デフォルト値を伴う束縛（`const { calls = [] } = sendMail.mock;`、`(sent = []) => ...`）
- 再代入。すべての代入の右辺を見て、1 つでも記録に行き着けば違反
- 関数パラメータ。同一ファイル内で静的に解決できる呼び出し元の実引数まで辿る

### 意図的に広げていない範囲

| 形 | 対象にしない理由 |
| --- | --- |
| `sendMail.mock.results` / `sendMail.mock.settledResults` | 「何を返したか」の記録。このルールの対象は「どう呼ばれたか」に限っている |
| `expect(sendMail).toHaveBeenCalledWith(...)` | 受け手がモック束縛そのもので、記録に行き着かない |
| 制御フローのためだけに取り出した記録 | 見ているのはアサーションの受け手と fixture が返す subject の 2 か所だけ。取り出したこと自体は違反ではない。fixture 間で受け渡す形も同じ |
| `expect({ calls: sendMail.mock.calls })` | 記録をオブジェクトや配列に包んだ形。連鎖と束縛だけを辿り、リテラルの内側には降りない。この形は fixture 側の別ルールが落とす |
| 実行時にしか呼び出し元が決まらない経路 | 条件で差し替わる関数束縛を通した受け渡し、実行時に決まる呼び出し元からのパラメータ。辿るべき呼び出し元が静的に決まらない |
| 可変長パラメータ・展開した実引数・計算されたプロパティ名 | 実引数とパラメータを突き合わせる位置が静的に決まらない。`(...sent) => ...`、`observe(...args)`、`const { [named]: sent } = sendMail.mock;` が該当する |
| `expect(sendMail.mock)` | 名前空間そのものとの比較。記録プロパティが現れないため、綴りだけで見分けると無関係な `mock` プロパティを巻き込む |
| 別ファイルの宣言を経由した転送 | 実行系がファイルを跨ぐ解決を提供しない。同一ファイルの中で閉じた追跡に限っている |

適用範囲はテスト宣言ファイルに限る。既定では `.test.ts` / `.test.tsx` で終わるファイル。

## なぜそれが要るか

守っている不変条件は「『その関数がどう呼ばれたか』を主張するアサーションは、matcher の名前でそれを主張する」ことである。

1 層目は失敗時の可読性である。`toHaveBeenCalled*` 系は、失敗メッセージが「何回呼ばれたか」「どの引数で呼ばれたか」の言葉で出る。同じ検査を呼び出し記録の配列比較に落とすと、失敗は無名の配列に対する一般的な等価エラーになる。読み手は「何を検証していたテストなのか」をコードから復元する羽目になる。

2 層目は意図の置き場所である。fixture が記録を返すと、fixture が返すものが「検査対象が生んだ出力」ではなく「観測の中間表現」になる。fixture の意味そのものが壊れ、fixture が SUT 出力を返している前提で判定している他のルールも道連れになる。

3 層目は、回避のしやすさである。matcher の集合で禁止すると、集合外の matcher（プロパティパスを指定するもの、名前空間そのものとの比較）へ載せ替えるだけで同じ検査を続けられる。受け手の形だけで判定することで、載せ替えでは外れなくなる。

## どう直すか

アサーション側は、モック束縛そのものを `expect` に渡し、意図を matcher に移す。

- 引数の主張: `toHaveBeenCalledWith` / `toHaveBeenCalledExactlyOnceWith` / `toHaveBeenLastCalledWith` / `toHaveBeenNthCalledWith`
- 回数の主張: `toHaveBeenCalledTimes` / `toHaveBeenCalledOnce`
- 存在の主張: `toHaveBeenCalled`
- 非存在の主張: 同じ名前を `not` の後ろに置く

fixture 側は、記録ではなくモック束縛そのものを返す。

```ts
const test = baseTest.extend("sendMail", () => sendMail);
test("addresses the recipient", ({ sendMail }) => {
  expect(sendMail).toHaveBeenCalledWith("a@example.com");
});
```

この直し方は、各テストの前に呼び出し記録をクリアする共有のランナー設定（vitest の `clearMocks`）が入っていることを前提にする。クリアされないと、生きたモックにテスト間の呼び出しが累積し、回数のアサーションが実行順に依存して壊れる。設定を入れずにこのルールだけを有効にしない。

## 禁じる回避策

- **記録を中間変数に束ねる。** 束縛の出所まで辿るので落ちる
- **分割代入で記録や名前空間を取り出す。** 取り出したプロパティ名を見るので落ちる
- **多段の転送を挟む。** 段数の上限を置いていないので落ちる
- **パラメータや再代入される束縛に一度入れ直す。** 呼び出し元の実引数と、すべての代入の右辺を辿るので落ちる
- **別の matcher に載せ替えて同じ検査を続ける。** matcher の集合を持たないので落ちる
- **記録をオブジェクトや配列に包んで fixture から返す。** このルールは報告しないが、許しているわけではない。fixture 側で別の値から subject を組み直す形は別のルールが落とす
- **`expect(sendMail.mock)` のように名前空間そのものを比較する。** 型情報が無い実行系では無関係な `mock` プロパティと区別できないため報告しないが、これは検出の限界であって許可ではない。呼び出し記録の比較として書かない
- **記録の読み出しを別ファイルのヘルパへ移す。** 同一ファイルの中で閉じた追跡なので報告は消えるが、subject が記録であることは変わらない
- **抑制ディレクティブ**

## オプション

| 名前 | 既定値 | 意味 |
| --- | --- | --- |
| `callRecordMembers` | `["calls", "contexts", "instances", "invocationCallOrder", "lastCall"]` | 呼び出し記録とみなすプロパティ名の集合 |
| `specFileSuffixes` | `[".test.ts", ".test.tsx"]` | テスト宣言ファイルとみなすファイル名の接尾辞 |

`callRecordMembers` は既定値を丸ごと置き換える。空の配列を渡した場合は既定値のままになる。「何を返したか」側のプロパティ名（`results` / `settledResults`）は既定値に含めない。含めるとこのルールの担当範囲が変わる。
