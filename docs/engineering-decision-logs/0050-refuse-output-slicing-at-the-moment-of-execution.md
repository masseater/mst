# 0050. 出力を切り取る読み方を、実行の直前で拒む

- ステータス: Accepted
- 日付: 2026-08-13

## 文脈

`@mst/ai-native` の AGENTS.md には「読み手の規律」がある。要約が指す記録ファイルを開くこと、同じコマンドをフィルタ付きで再実行しないこと。これは案内でしかない。破っても破った当人の実行は成功し、代償は出力を読む側の context window にしか現れる。[EDR 0036](0036-fix-the-wrapper-prefix-per-layer-and-check-it-where-manifests-are-checked.md) が包み忘れについて同じ構図を認めて、検査を実行ではなく定義（package.json の scripts）へ置いた。

今回の違反は定義に現れない。`vp test | tail -50` はどのマニフェストにも書かれず、その場で組み立てられて消える。検査できる場所は実行の直前しかない。Claude Code の `PreToolUse` はそこにある唯一の門で、コマンド行を実行前に受け取り、`deny` と理由を返せる。

## 決定

**`unabridged` を 3 つ目のコマンドとして足す。** `throttle` と `spool` が包むのに対し、これは包まない。標準入力から `PreToolUse` の JSON を読み、標準出力へ判断を返す。同じパッケージに置くのは、守る資源が `spool` と同一（呼び出し元の context window）で、拒否の理由が `spool` の使い方そのものを指すからである。

**見るのはコマンド位置だけである。** コマンド行を [shell-quote](https://github.com/ljharb/shell-quote) で分解し、先頭の語と、コマンドを始める演算子（`|` `||` `&&` `|&` `;` `;;` `&` `(` `<(`）の直後の語だけを検査する。リダイレクトの右辺は検査しない。語の前置きのディレクトリは落とすので `/usr/bin/tail` も同じ扱いになる。この分け方によって `git rev-parse HEAD`・`echo 'tail'`・`cat headers.txt`・`vp test > tail` が通る。文字列として `head` / `tail` を探す実装は、この 4 つを全部誤検知する。

**`head` と `tail` はコマンド位置にある限り全部拒む。** パイプ経由に限らず、ファイルを引数に取る形も `-f` も拒む。代替が全部そろっているためで、ファイルの一部は Read の offset と limit、コマンド出力は `spool` と記録ファイルの Read、書かれている最中の記録は Read の読み直しで足りる。用途ごとに例外を作ると、どの用途かを機械が判定できないまま書き手が選べるようになる。

**判断は `run` の外の純関数に置く。** cc-hooks-ts の `trigger` に書いたツール名は実行時に何も絞らず（実測、`.claude/rules/ai-generated/gotchas.md`）、一方で `PreToolUse` の入力型はツール固有の枝を持つため、不正なペイロードを型の上で組み立てられない。分岐を `run` に置くと、通らないはずの入力を渡すテストが書けないままカバレッジだけが緑になる。`(toolName: string, toolInput: unknown)` を受ける純関数に判断を出し、`run` はその戻り値を `context.success` と `context.json` へ振り分けるだけにした。

**配線はこのリポジトリの `.claude/settings.json` に限る。** `matcher` を `Bash` にして 1 本だけ登録する。グローバルの設定には置かない。他のリポジトリには `spool` が無く、拒否だけが残って出口が塞がるためである。

## 影響

**公開面に重い依存が乗った。** cc-hooks-ts は `@anthropic-ai/claude-agent-sdk` を引き、単独インストールで 106 packages になる。`@mst/ai-native` は publish 対象なので、この重さは利用者にも渡る。hook の入出力は JSON 1 往復で、自前で書けば依存は増えない。それでも採るのは、Claude Code 側のスキーマ変更に追従する責任を上流へ預けるためである。捨てるなら、捨てる時に valibot 相当の入力検証を自前で持つことになる。

**捕まえられない形が残る。** `bash -c '... | tail'` は内側が 1 個の文字列トークンにしかならず、`xargs head` の `head` はコマンド位置に来ない。どちらも通る。広げるには入れ子のシェル解釈が要り、正当な記述と違反を区別する基準を作れていないので、境界として記録する。

**案内した手段が無い場所では、拒否が行き止まりになる。** `unabridged` は `spool` が届くかを確かめない。実測では、Bash から `spool` は PATH に無く `command not found` になり、案内が空振りした。理由の文面に `vp exec spool -- <command>` を併記して塞いだが、どちらも無い作業ツリーでは出口が残らない。

**このリポジトリに `.claude/settings.json` ができた。** 以後この種の門はここに集まる。設定は版管理されるので、作業ツリーを問わず同じ規律がかかる。
