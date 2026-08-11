# no-citty-parent-run--move-run-into-a-subcommand

## 何を検出するか

citty の `defineCommand` に渡すオブジェクトが、`subCommands` と `run` を同時に宣言している形を検出する。報告位置は `run` プロパティそのもの。

`defineCommand` の判定は import に基づく。`"citty"` から import された `defineCommand`（改名 import と名前空間 import を含む）の呼び出しだけを見るので、同名の別ライブラリの API や自前関数には反応しない。

## なぜそれが要るか

citty の `runCommand` は、サブコマンドの実行を終えたあとに必ず親コマンドの処理へ戻り、親に `run` があればそれを実行する（[v0.2.2 の `src/command.ts`](https://github.com/unjs/citty/blob/v0.2.2/src/command.ts) で確認できる。main も同じ）。つまり `subCommands` を持つ親に `run` を置くと、サブコマンドが成功するたびに親の `run` の出力が後ろに混ざり、パイプで消費できるはずだった stdout が汚れる。

逆に親に `run` が無ければ、サブコマンド名の指定が無い呼び出しは `E_NO_COMMAND` で失敗する。これはサブコマンド式 CLI として望ましい挙動であり、「引数無しで呼んだら usage が出て非ゼロで終わる」という利用者の期待に一致する。

引数無しの呼び出しに既定の動作を与えたい場合のために、citty は `default` プロパティを持つ。`default` はサブコマンド名を指名する形なので、既定の動作も名前を持ったサブコマンドとして表に出る。なお `default` と `run` の同時指定は citty 自身が `E_DEFAULT_CONFLICT` で拒否する。拒否されないのは `subCommands` と `run` の組だけであり、その組こそが出力を汚す。書き手が意図した結果になることのない形なので、機械で止める。

## どう直すか

親の `run` を削除し、やらせたかったことをサブコマンドとして切り出す。

```ts
import { defineCommand } from "citty";

import { checkCommand } from "./check-command.ts";

export const dontReviewItCommand = defineCommand({
  meta: {
    name: "dont-review-it",
    description: "Run the checks that keep review questions answered by machines.",
  },
  subCommands: {
    check: checkCommand,
  },
});
```

引数無しの呼び出しに既定の動作を与えたいなら、暗黙の親 `run` に埋めず、`default: "check"` のようにサブコマンドを指名する。

## 違反にならないもの

- サブコマンドを持たないコマンドの `run`。葉のコマンドは `run` が本体である
- `subCommands` だけを持つ親。バリデーションや文脈共有が要るなら `setup` が使える
- `subCommands` と `default` の組。既定の動作が名前を持ったサブコマンドとして表に出ている形であり、このルールが推す直し方そのもの
- citty 以外から import した同名 API や、自前で定義した `defineCommand` の呼び出し

## 禁じる回避策

- `run` の中身を関数に切り出して `run: dispatchFallback` のように参照で渡す。宣言の形は同じであり検出されるが、仮に検出を外れる書き方を見つけても、サブコマンド成功後に親の処理が走る事実は変わらない
- スプレッドで `run` を持つオブジェクトを合成して静的検出を外す。出来上がるコマンドの挙動は同じである
- 親の `run` の代わりに `setup` へ本体の処理を移す。`setup` はどのサブコマンドの前にも走るため、全サブコマンドの出力を汚す形に悪化する

機械検出の範囲と規律の範囲は一致しない。検出は不変条件を守るための下限であって、上限ではない。
