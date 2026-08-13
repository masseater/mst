# no-replaced-double-behaviour--let-the-replaced-module-answer

## 何を検出するか

spec ファイルの中で、差し替えたモジュール由来のダブルに対して返す値や実装を設定している呼び出しを報告する。設定として数える member は `mockReturnValue` 族・`mockResolvedValue` 族・`mockRejectedValue` 族・`mockImplementation` 族・`mockReturnThis`・`withImplementation` である。

「差し替えたモジュール由来」の同定は束縛の出どころで行う。設定の受け手をたどり、import で入ってきた名前に行き着けば差し替えたモジュールのものとして扱う。たどる経路は 3 つある。

- import した名前そのもの（`send.mockReturnValue(1)`）
- import した名前のメンバ（`mailer.send.mockReturnValue(1)`）
- 実行時に型を付け替えるための呼び出しを通したもの（`vi.mocked(send).mockReturnValue(1)`）

途中に置かれた束縛もたどる。`const double = vi.mocked(send);` を経由しても同じ設定として読む。

`vi.fn()` でその場に作ったダブルは対象にしない。テストが引数として渡すダブルは置き換えではなくテストの入力であり、走らなくなる本物が存在しないためである。

member が実行時にしか決まらない形（`double[member](1)`）は読まない。呼び出しの位置から何を設定したかが確定しないため、報告しない。

## なぜそれが要るか

守っている不変条件は「差し替えたモジュールは、どう呼ばれたかを記録するだけで、答えない」ことである。

モジュールを差し替えてよいのは、そこが外部 I/O の境界だからである（[no-non-boundary-double--replace-at-the-external-boundary](./no-non-boundary-double--replace-at-the-external-boundary.md)）。境界を差し替えるのは、テストが外へ出ないようにするためであって、境界の向こうから返ってくる値をテストが決めるためではない。

返す値を設定した時点で、そのテストが読み戻すのは自分で書いた値になる。差し替えた側は一度も走らず、設定した値と期待値が一致することだけが確かめられる。これは対象の振る舞いについて何も言っていない。テストは緑になり、消えた検証は誰の目にも触れない。

呼び出し記録は残る。どう呼ばれたかは `toHaveBeenCalledWith` 族で主張できるので、境界に対して「何を渡したか」を確かめる道は閉じていない。閉じるのは「何が返ってきたことにするか」を spec が決める道だけである。

### 他のルールとの境界

| 形 | 見ているもの |
| --- | --- |
| 差し替えてよい対象か | `no-non-boundary-double--replace-at-the-external-boundary` |
| 差し替えの宣言がファクトリを渡しているか | `no-vi-mock-factory-behavior--use-spy-true-and-fixture` |
| ダブルを立てる位置と設定する位置 | `no-module-scope-mock-config--lift-into-fixture` |
| 差し替えたダブルが答えているか | 本ルール |

`no-module-scope-mock-config` は設定の**位置**を見ており、fixture の中へ移すことを求める。差し替えたモジュール由来のダブルについては、移した先でも本ルールが報告する。2 本が同時に出たときは、設定そのものを消せば両方が消える。

## どう直すか

設定を消す。差し替えたモジュールは素通しのまま残り、テストは呼ばれ方だけを主張する。

```ts
vi.mock(import("./transport.ts"), { spy: true });

const it = test.extend("theDeliveryOfOneMessage", () => deliver(MESSAGE));

it("hands the message to the transport", ({ theDeliveryOfOneMessage }) => {
  expect(vi.mocked(send)).toHaveBeenCalledWith(MESSAGE);
});
```

テストが特定の値を必要としているなら、その値は差し替えたモジュールからではなく、対象の引数から渡す。渡せる形になっていないときは、注入境界を作るのが実装の側の設計変更であり、その条件は[テストの書き方](../../../../docs/guidelines/tests.md)が持っている。

### 設定しなければ書けないとき

境界の向こうにしか答えが無く、外から決められない場合がある。そのときは、その行の上に理由付きの指示を残す。

```ts
// mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer -- whether the pipeline started is settled inside the boundary this spec replaces
vi.mocked(startLintTelemetry).mockReturnValue(false);
```

指示は行ローカルで、理由が空なら例外として成立せず、指示そのものが報告される。理由には「何が外から決められないか」を書く。ルール名を書くのは、1 つの指示が他のルールまで黙らせないためである。

## 違反にならないもの

- `vi.fn()` でその場に作り、対象へ引数として渡すダブル
- 呼び出し記録に対する主張（`toHaveBeenCalledWith` 族）
- 呼び出し記録を消す操作（`mockClear`）。何を返すかを決めていない
- spec でないファイル
- 理由を伴う行ローカルの指示が上に置かれた設定

## 禁じる回避策

- 設定を fixture の中へ移す。位置は関係しない。差し替えたダブルが答えていることは変わらない
- 差し替えたダブルを別の名前に束ね直してから設定する。束縛はたどる
- member を実行時に組み立てて読めなくする。判定は消えるが、差し替えた側が走らないことは変わらない
- 理由を書かない指示を置く。指示そのものが報告される
- 抑制ディレクティブ

## オプション

- `specFileSuffixes` — spec ファイルとして読む接尾辞
