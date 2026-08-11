# no-expect-projected-subject--use-tostrictequal-on-subject

## 何を検出するか

spec ファイルの中で、`expect(...)` が受け取った第一引数が裸の識別子でないアサーション。

受け手は `expect(...)` と `expect.soft(...)` / `expect.poll(...)` に解決できるものに限る。`not` / `resolves` / `rejects` を挟んでいるかどうかは関係しない。判定するのは `expect` に渡された値であって、matcher でも期待値でもない。

型アサーション・非 null アサーション・オプショナルチェーン・括弧・`await` は剥いでから見る。`expect(await report)` の subject は `report` であり、裸の識別子として扱う。

渡された値の形ごとに、報告する内容が変わる。

- メンバ式（`expect(report.total)`）— `projectedSubject`
- 配列リテラル（`expect([report.id, report.total])`）— `bundledSubject`
- その場に書いた関数（`expect(() => summarise(entries))`）— `inlineFunctionSubject`
- 文字列・数値・真偽値のリテラル、および置換のないテンプレート（`expect(2)`）— `writtenOutSubject`
- 上記以外の式。比較・条件式・論理式・置換のあるテンプレート・スプレッド — `derivedSubject`

### 他のルールが担当する形

次の形は違反でないのではなく、報告する担当が別にある。ここでは報告しない。

- 呼び出し式・`new` 式・タグ付きテンプレート — `no-expect-call-expression--yield-from-fixture` が担当する
- オブジェクトリテラル — 合成した subject を禁じるルールが担当する

裸の識別子でない形のうち、この 2 つを除いた全部をこのルールが引き受ける。担当のいない形が構造的に生まれないようにするための配分であり、「メンバ式だけを見るルール」ではない。

モックの呼び出し記録を覗く形（`expect(send.mock.calls)`）は構文上メンバ式なので、この配分ではここに入る。意図の担当は `no-expect-mock-call-inspection--use-to-have-been-called-family` にあるが、報告は抑えていない。`projectedSubject` の報告文にモック向けの直し方（束縛そのものを fixture から受け取り、`toHaveBeenCalledWith` で見る）を載せてある。

### 例外

subject が大きすぎて完全一致がかえって意図を隠すことがある。この場合に限り、根を丸ごと記録する snapshot を別の it に置き、射影の it は「その一点の意図」を名指しするものとして残せる。

例外が成立する条件は 3 つで、すべて満たしたときだけ報告しない。

- 射影の根が、そのテストブロックが fixture から分割代入で受け取った束縛であること。別名で受けていても同じ fixture に行き着けばよい
- 同じ束縛に対して snapshot 系 matcher を当てているアサーションが、別のテストブロックにあること
- その 2 つのテストブロックが、同じ文の並びに直接置かれていること

```ts
const test = baseTest.extend("report", () => summarise(entries));

describe("report", () => {
  test("records the whole report", ({ report }) => {
    expect(report).toMatchSnapshot();
  });

  test("marks the total", ({ report }) => {
    expect(report.total).toBe(2);
  });
});
```

「同じ文の並び」は、`describe` があればそのコールバックの本体、なければファイルの直下を指す。`describe` を持たない spec でも例外は成立する。親の `describe` や内側の `describe` に置いた snapshot は数えない。

snapshot の記録先は問わない。外部ファイルに置く形もコードに埋める形も同じに扱う。例外はアサーションの形だけで決まる。snapshot の subject が裸の識別子である以上、その記録は根を丸ごと写しているので、記録の中身を読む必要がない。

## なぜそれが要るか

守っている不変条件は「アサーションの subject が、fixture が返した根そのものである」ことである。

フィールド単位のアサーションは、そのフィールド以外について何も言わない。`expect(report.total).toBe(2)` が緑であることは、`report` に別のフィールドが増えたことも、`id` が改名されたことも、`meta` の中身がずれたことも否定しない。射影の外側で起きた変更はすべて素通りする。

壊れ方は 2 層ある。

1 層目は、検証されていない領域が subject の大部分を占めることである。根を `toStrictEqual` で 1 回比べれば、欠けたフィールド・増えたフィールド・改名のすべてが落ちる。射影はそのどれも捕まえない。

2 層目は、検証されていないことがコードから見えないことである。射影のアサーションは、書いた本人には「その 1 点を意図して選んだ」ように読めるが、読み手には「他のフィールドは別のどこかで見ているのだろう」としか読めない。実際にはどこでも見ていない、という状態が緑のまま残る。フィールドごとにアサーションを増やしても同じで、名指ししなかったフィールドは最後まで未検証のままになる。

subject が根でない形は、射影以外にも同じ性質を持つ。その場で組み立てた配列・その場で書いた関数・spec に書き下したリテラルは、いずれも「コードが生んだ値」ではなく「テストが作った値」を subject にしている。根が fixture から来ていないという 1 点で同じ違反であり、同じ不変条件が壊れる。

## どう直すか

根そのものを完全一致で固定する。

```ts
test("summarises the entries", ({ report }) => {
  expect(report).toStrictEqual({ id: "a", total: 2, meta: { source: "orders" } });
});
```

subject をその場で作っていた場合は、作る手順を fixture へ移し、返ってきた束縛をアサーションに渡す。例外を見るなら、fixture が引数なしのサンクを返し、it はそのサンクの識別子を渡す。

モックや関数の束縛を検証したい場合は、その束縛そのものを fixture が返し、呼ばれ方は `toHaveBeenCalled*` 系で見る。呼び出し記録を値として覗かない。

subject が大きすぎて完全一致が意図を隠す場合に限り、同じ並びに snapshot の it を足す。順序は、まず根を snapshot で固定し、そのうえで意図した振る舞いを射影で名指しする。射影を別の射影に置き換えるのは直し方ではない。

## 禁じる回避策

- 射影を配列リテラルやオブジェクトリテラルに束ねて完全一致させる。subject が根でない時点で落ちる（オブジェクトリテラルは合成 subject を禁じるルールが落とす）
- 気になるフィールドごとに射影のアサーションを分割する。未検証のフィールドは増えたままで、報告が増えるだけになる
- 射影を fixture 側へ押し込み、fixture が `report.total` を返すようにする。fixture が SUT の出力を射影して返すことは別のルールが禁じている
- 根を検証しないまま、射影の隣に無関係な snapshot を足して例外条件だけ満たす。例外は「その根を丸ごと記録した snapshot がある」ことで成立する。別の束縛に対する snapshot も、fixture から来ていない束縛に対する snapshot も数えない
- 射影の it と snapshot の it を、別々の `describe` に分けて置く。同じ並びに直接置かれた it だけを見る
- 型アサーションやオプショナルチェーンで包む。剥いでから見る
- 抑制ディレクティブ

## オプション

- `snapshotMatchers` — 例外の根拠として認める snapshot 系 matcher の名前。既定はテストランナーが持つ snapshot 系 matcher 一式（`toMatchSnapshot` / `toMatchInlineSnapshot` / `toMatchFileSnapshot` / `matchSnapshot` / `toThrowErrorMatchingSnapshot` / `toThrowErrorMatchingInlineSnapshot`）。空の配列を渡すと例外そのものが無くなる
- `specFileSuffixes` — spec ファイルと見なす接尾辞。既定は `.test.ts` と `.test.tsx`

対象を「射影だけ」に狭めるオプションは持たない。守っているのは「subject が根そのものであること」であって、射影はその最も多い破り方にすぎない。狭められるようにすると、他の形に置き換えるだけで同じ不変条件を破れる。
