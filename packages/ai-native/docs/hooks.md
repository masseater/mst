---
description: Claude Code の hook を cc-hooks-ts で書くときに守ること
---

# hook の書き方

このパッケージの `unabridged` は Claude Code の `PreToolUse` hook である。hook を足すとき、または `unabridged` を変えるときに守る。

## ツール名の門

`trigger` に書いたツール名は入力の型を絞るだけで、実行時には何も絞らない。宣言していないツールのペイロードが `run` に届く。

- IF: hook をツールで限定する; THEN
  - MUST: `settings.json` の `matcher` と `run` の中の `tool_name` の確認を両方置く
  - PROHIBIT: `matcher` だけに頼る
    - 別の設定から同じ実行ファイルを呼ばれた経路が残る
- IF: `tool_input` を読む; THEN
  - MUST: `unknown` として受け、必要な形を自分で確かめる
  - PROHIBIT: 宣言したツールの形で届くものとして読む

## 判断の置き場所

`PreToolUse` の入力型はツールごとの枝を持つ union で、宣言と食い違うペイロードは型の上で組み立てられない。`run` の中に置いた分岐は、その側を覆えないままカバレッジだけが緑になる。

- IF: hook に分岐を書く; THEN
  - MUST: 分岐を `run` の外の純関数に置き、`(toolName: string, toolInput: unknown)` を受ける形にする
  - MUST: 不正な入力の網羅をその純関数のテストで行う
  - PROHIBIT: `run` に分岐を残す
- IF: `run` をテストする; THEN MUST: 正しいペイロード 1 種類で、返す判断の形だけを確かめる

## 入口とテスト

- IF: 入口のファイルを書く; THEN
  - MUST: `runHook` の呼び出しだけを置く
  - PROHIBIT: `import.meta.main` のガードを置く
    - ガードの内側はテストから実行されず、カバレッジの下限に届かない
- IF: 手でペイロードを組んで実行を試す; THEN MUST: `tool_use_id` を入れる
  - 欠けると入力の検証で弾かれ、`run` に到達しないまま非ゼロで終わる

## 公開する定義の型

`defineHook` が返す型は cc-hooks-ts が export していない型を参照する。推論のままにすると宣言ファイルを書けず、`tsc -p .` が TS4023 で落ちる。

- IF: hook の定義を export する; THEN MUST: `ReturnType<typeof defineHook<...>>` で型を明示する
