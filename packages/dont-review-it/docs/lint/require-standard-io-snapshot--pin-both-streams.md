# require-standard-io-snapshot--pin-both-streams

## 何を検出するか

`standardIoTest` からテストを導出しているファイルが、捕捉された 2 ストリームのスナップショットを欠いている状態を検出する。要求は「stdout と stderr のそれぞれに、`expect(stdout.text)` / `expect(stderr.text)` を主語とするスナップショット assertion が最低 1 つある」ことで、`toMatchInlineSnapshot` と `toMatchSnapshot` のどちらでも満たせる。

導出の判定は import した `standardIoTest`（改名 import を含む）の呼び出しで行い、`standardIoTest.skip` のような修飾呼び出しも導出に数える。`const it = standardIoTest.extend(...)` のように束縛へ導出した形も、その束縛からの呼び出しを含めて追跡する。導出の連鎖（導出した束縛からさらに `extend` した束縛）も同様に数える。欠けているストリームごとに 1 件、最初の導出呼び出しの位置に報告する。

フィクスチャを使っていないファイルには何も要求しない。

## なぜそれが要るか

CLI の stdout / stderr はユーザー向けの契約である。`standardIoTest` で捕捉していても、捕捉したテキストをどこにも固定していなければ、出力は何に変わっても全部の assertion が通り続ける。「捕捉しているから検証している」という見た目だけが残る。

`toContain` のような内容の assertion は、書き手が意識した断片しか守らない。ストリーム全体のスナップショットを 1 つ置くと、書き手が意識していなかった側の変化 — 進捗表示の混入、警告の増減、末尾改行の変化 — がスナップショット差分として現れる。両方のストリームに要求するのは、意識の外に置かれがちなのがたいてい「もう片方のストリーム」だからである。

## どう直すか

各ストリームを固定するテストを足す。

```ts
import { standardIoTest } from "@mst/dont-review-it/vitest";

standardIoTest("matches the stdout snapshot", ({ stdout }) => {
  process.stdout.write("result\n");

  expect(stdout.text).toMatchInlineSnapshot(`
    "result
    "
  `);
});

standardIoTest("matches the stderr snapshot", ({ stderr }) => {
  expect(stderr.text).toMatchInlineSnapshot(`""`);
});
```

出力にテンポラリパスのような実行ごとに変わる値が混ざってスナップショットにできない場合は、その値が混ざらない不変の経路（決定的な違反メッセージなど）を選んでスナップショットし、変動する経路は内容の assertion で補う。

## 違反にならないもの

- スナップショットの横に置かれた内容の assertion。スナップショットが全体を、内容の assertion が意図を守る分担は歓迎される
- `standardIoTest` を import も使用もしないファイル
- 片方のストリームしか使わないテストが混ざること。要求はファイル単位であり、テスト単位ではない

## 禁じる回避策

- フィクスチャの束縛を別名に付け替えて（`({ stdout: out })`）、主語の静的判定を外す。固定されていない事実は変わらない
- `stdout.text` を変数に移してからスナップショットし、判定を外す。同上
- `expect(stdout).toMatchInlineSnapshot()` のように捕捉ハンドルそのものをスナップショットする。捕捉されたテキストではなくオブジェクトの外形が固定され、出力の変化を検出しない
- 空のテストにスナップショットだけ置いて要求を満たし、実際の実行経路を通さない。固定されるのは空文字列であり、契約は守られない

機械検出の範囲と規律の範囲は一致しない。検出は不変条件を守るための下限であって、上限ではない。
