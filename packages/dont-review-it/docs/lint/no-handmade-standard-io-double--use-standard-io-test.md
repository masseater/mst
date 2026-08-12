# no-handmade-standard-io-double--use-standard-io-test

## 何を検出するか

テストファイル（`*.test.ts` / `*.test.tsx` / `*.spec.ts` / `*.spec.tsx`）が stdout / stderr のテストダブルを自前で組み立てている形を検出する。系統は 3 つある。

1. `*.extend({ ... })` のフィクスチャ定義に `stdout` / `stderr` という名前を宣言する形。第 1 引数に名前を文字列で渡す builder 形式（`*.extend("stdout", ...)`）も同じ再宣言として扱う。共有フィクスチャを import しているファイルでも、宣言し直した時点で報告される
2. `process.stdout` / `process.stderr` への直接の参照。spy を張る形も、直接書き込む形も同じ違反として扱う。ただし `standardIoTest` を import 済みのファイルは除く。捕捉が共有フィクスチャに一元化されたうえで、テスト対象にストリームへ書かせる行為そのものは正当だからである
3. `stdout` / `stderr` という名前のプロパティに、`write` メソッドを持つオブジェクトリテラルやストリームのインスタンス（`new PassThrough()` など）を与える形。テスト対象へ手製の偽ストリームを注入する書き方が該当する

テストファイル以外では何も報告しない。共有フィクスチャの実装自体がストリームの捕捉を組み立てる場所であり、そこはこのルールの対象外である。

## なぜそれが要るか

標準ストリームのテストダブルには、捕捉の張り替え・チャンクの復号・テスト後の復元という付随作業が必ずついてくる。spec ごとに組み立てると、この付随作業が spec の数だけ別実装になり、それぞれが独自の癖（復元漏れ、エンコーディングの違い、並行実行時の干渉）を抱える。1 つの spec で見つかった不具合の修正は他の spec に伝播しない。

この付随作業は一度だけ解決すればよい種類の問題であり、その解決が `@mst/dont-review-it/vitest` の `standardIoTest` フィクスチャである。spec 側に残る仕事は「テストを走らせ、捕捉されたテキストを検証する」ことだけになる。

## どう直すか

`standardIoTest` を import し、そこからテストを導出する。捕捉されたテキストはフィクスチャの `text` で読める。

```ts
import { standardIoTest } from "@mst/dont-review-it/vitest";

standardIoTest("hands the subject everything written to stdout", ({ stdout }) => {
  process.stdout.write("progress line\n");

  expect(stdout.text).toBe("progress line\n");
});
```

テスト対象へストリームを注入していた場合は、注入をやめてテスト対象に `process.stdout` / `process.stderr` へ書かせ、フィクスチャで捕捉する。

## 違反にならないもの

- `standardIoTest` を import した spec が、テスト対象を通じて `process.stdout` / `process.stderr` へ書く行為
- `repository` のような、ストリームと無関係な名前の `extend` フィクスチャ
- `stdout` という名前に文字列など「書き込み先ではない値」を持たせたプロパティ。捕捉結果の受け渡しは双子ではない
- `process.exitCode` や `process.env` など、捕捉対象の 2 ストリーム以外の `process` メンバー

## 禁じる回避策

- 偽ストリームを一度変数に束ねてからプロパティに与え、値の形の静的判定を外す。組み立てている実体は変わらない
- `standardIoTest` という名前のモジュールを自作して import し、除外条件だけを満たす。除外は共有フィクスチャの実装を信頼して置かれているのであって、名前に与えられているのではない
- stdin のテストダブルを組み立てる。現時点のフィクスチャは stdout / stderr だけを提供するため機械検出はしないが、同じ性質の違反である。stdin の捕捉が必要になったら、spec に組み立てるのではなく共有フィクスチャ側に足すこと

機械検出の範囲と規律の範囲は一致しない。検出は不変条件を守るための下限であって、上限ではない。
