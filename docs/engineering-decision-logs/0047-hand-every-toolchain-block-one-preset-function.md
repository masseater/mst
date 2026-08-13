# 0047. ツールチェーンの各ブロックに preset の関数を 1 つずつ渡す

- ステータス: Accepted
- 日付: 2026-08-13

## 文脈

`@mst/dont-review-it` は `oxlint`、`withGitExcludes`、そして [0046](0046-let-the-formatter-own-where-markdown-lines-break.md) が足した整形の選択という 3 つのものを公開面に並べていた。利用者の `vite.config.ts` は、`lint` に `withGitExcludes({ extends: [oxlint, ...] })` を書き、`fmt` に `withGitExcludes({ ...整形の選択 })` を書く。どれをどのブロックへどう組むかは呼び出し側の作業であり、組み方を間違えても lint は緑のまま通る。

組み合わせを呼び出し側に持たせている理由は、道具の側の制約にあった。oxlint は `extends` で名指しした設定の `ignorePatterns` を捨てるため、除外パターンは `defineConfig` に直接渡すオブジェクト自身が持つしかない。oxfmt には `extends` が無く、整形の選択も同じく直接渡すオブジェクトが持つしかない。つまりどちらのブロックも、preset を「参照する」形では配れない。

この制約は「呼び出し側が組む」ことを要求しない。要求しているのは「直接渡すオブジェクトが値を持っている」ことだけで、そのオブジェクトを preset の側が作って返せば足りる。

`lint-rule-authoring` と `verified-specifications` の preset も同じ場所に並んでいた。どちらも `dont-review-it` が前提にしているルール群で、片方だけを配線した状態に意味は無い。

## 決定

**公開面を `dontReviewItPreset` の 1 つに畳み、`fmt` と `lint` の 2 つの関数にする。** 呼び出し側はブロックの名前と同じ名前の関数を呼ぶ。関数は、そのブロックが直接持たなければ効かないもの（git 由来の除外パターン、ルール集合、整形の選択）を載せた設定を返す。

`lint` が返す `extends` には `lint-rule-authoring`、`dont-review-it`、`verified-specifications` の preset がこの順で入る。3 つを 1 つの内部依存として扱い、`dont-review-it` を入れた利用者に 3 つとも届く。呼び出し側が渡した `extends` は後ろに並ぶ。

`no-unwrapped-toolchain-config--wrap-with-git-excludes` を `no-unwrapped-toolchain-config--call-the-preset-for-the-block` に置き換える。見る対象を「ラッパを通っているか」から「そのブロックに対応する preset の関数を呼んでいるか」に広げ、`fmt` に `lint` の関数を置いた取り違えも報告する。

## 影響

利用者が書くのは 1 つの import と、ブロックごとの 1 回の呼び出しだけになる。preset に何が入っているかを知らなくても、配線として正しい状態が既定になる。

`oxlint` と `withGitExcludes` は公開面から消える。preset の内部モジュールとして残るが、外から名指しはできない。3 つを個別に組み替えて使う道は塞がれ、[0042](0042-apply-one-preset-at-the-root-and-report-the-exception-the-toolchain-forces.md) が言う「採用の判断を残さない」がツールチェーン設定の側にも及ぶ。

`@mst/dont-review-it` の依存に `@mst/verified-specifications` が加わる。インストールした利用者には仕様担保テストの検査も一緒に届く。

preset を組み立てるモジュールはテストから読まない。`dontReviewItPreset` は js プラグインを経由して全ルールの実装に届いており、テストが読み込むとルールの実装がカバレッジの対象へ入ってくる。preset が呼ぶ部品はそれぞれ単体で検査し、preset 自身は配線を見るルールが守る。
