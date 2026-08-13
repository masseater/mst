# require-standard-io-snapshot--pin-both-streams

## 何を検出するか

`standardIoTest` からテストを導出しているファイルが、捕捉された 2 ストリームのスナップショットを欠いている状態を検出する。要求は「stdout と stderr のそれぞれについて、そのストリームに届く値を主語とするスナップショット assertion が最低 1 つある」ことで、`toMatchInlineSnapshot` と `toMatchSnapshot` のどちらでも満たせる。

ストリームに届くかどうかは、スナップショットの主語の根にある識別子で決める。根がストリームの束縛そのもの（`stdout` / `stderr`）ならそのストリームに届く。根がこのファイルで宣言されたフィクスチャなら、そのフィクスチャが依存として受けた名前を辿り、ストリームに行き着くかを見る。依存の連鎖は段数に上限を置かず、行き着いた時点で届いたものとして数える。

綴りでは決めない。特定のメンバの読み出し（`expect(stdout.text)` のような形）だけを受理すると、フィクスチャが渡す値の射影を禁じている隣のルールと衝突し、どちらの要求も満たせない spec ができる。

導出の判定は import した `standardIoTest`（改名 import を含む）の呼び出しで行い、`standardIoTest.skip` のような修飾呼び出しも導出に数える。`const it = standardIoTest.extend(...)` のように束縛へ導出した形も、その束縛からの呼び出しを含めて追跡する。導出の連鎖（導出した束縛からさらに `extend` した束縛）も同様に数える。欠けているストリームごとに 1 件、最初の導出呼び出しの位置に報告する。

フィクスチャを使っていないファイルには何も要求しない。

## なぜそれが要るか

CLI の stdout / stderr はユーザー向けの契約である。`standardIoTest` で捕捉していても、捕捉したテキストをどこにも固定していなければ、出力は何に変わっても全部の assertion が通り続ける。「捕捉しているから検証している」という見た目だけが残る。

`toContain` のような内容の assertion は、書き手が意識した断片しか守らない。ストリーム全体のスナップショットを 1 つ置くと、書き手が意識していなかった側の変化 — 進捗表示の混入、警告の増減、末尾改行の変化 — がスナップショット差分として現れる。両方のストリームに要求するのは、意識の外に置かれがちなのがたいてい「もう片方のストリーム」だからである。

## どう直すか

各ストリームを固定するテストを足す。実行はフィクスチャに閉じ、`it` はストリームの束縛をそのまま主語に取る。

```ts
import { standardIoTest } from "@mst/dont-review-it/vitest";

const it = standardIoTest.extend("theRunOfTheCommand", { auto: true }, () => {
  runTheCommand(["--help"]);
});

it("pins what the run put on standard output", ({ stdout }) => {
  expect(stdout).toMatchInlineSnapshot();
});

it("pins what the run put on standard error", ({ stderr }) => {
  expect(stderr).toMatchInlineSnapshot();
});
```

ストリームの束縛をそのまま主語に取れるのは、束縛が列挙可能な面として書かれたチャンクだけを持つためである。スナップショットに現れるのは書かれた内容で、テキストへの畳み込みと書き込みの受け口は現れない。

テキストの形で固定したい場合は、フィクスチャの中で畳み込んでからその束縛を主語にする。

```ts
const it = standardIoTest.extend("theStandardOutputOfTheRun", ({ stdout }) => {
  runTheCommand(["--help"]);
  return stdout.text();
});

it("pins what the run put on standard output", ({ theStandardOutputOfTheRun }) => {
  expect(theStandardOutputOfTheRun).toMatchInlineSnapshot();
});
```

出力にテンポラリパスのような実行ごとに変わる値が混ざってスナップショットにできない場合は、その値が混ざらない不変の経路（決定的な違反メッセージなど）を選んでスナップショットし、変動する経路は内容の assertion で補う。

## 違反にならないもの

- スナップショットの横に置かれた内容の assertion。スナップショットが全体を、内容の assertion が意図を守る分担は歓迎される
- `standardIoTest` を import も使用もしないファイル
- 片方のストリームしか使わないテストが混ざること。要求はファイル単位であり、テスト単位ではない

## 禁じる回避策

- フィクスチャの束縛を別名に付け替えて（`({ stdout: out })`）、主語の静的判定を外す。固定されていない事実は変わらない
- ストリームに届かない値をスナップショットして件数だけ満たす。主語の根を辿るので、依存の連鎖がストリームに行き着かない値では満たせない
- 空のテストにスナップショットだけ置いて要求を満たし、実際の実行経路を通さない。固定されるのは空の記録であり、契約は守られない

機械検出の範囲と規律の範囲は一致しない。検出は不変条件を守るための下限であって、上限ではない。
