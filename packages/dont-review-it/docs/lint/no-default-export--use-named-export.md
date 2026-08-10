# no-default-export--use-named-export

## 何を検出するか

`export default` 文（`ExportDefaultDeclaration`）すべて。式でも関数宣言でもクラス宣言でも、無名の即値でも同じく報告する。

例外は 2 つだけで、いずれもファイルのベース名だけで判定する。

- `plugin.ts` — oxlint が `jsPlugins` の指定子から読むエントリ。プラグインオブジェクトを default export で受け取る規約になっている
- `vite.config.ts` — ビルドツールの設定ファイル。設定オブジェクトを default export で受け取る規約になっている

判定に使うのはベース名の完全一致である。`my-plugin.ts` や `plugin.entry.ts` は `plugin.ts` ではないので例外にならない。`vite.config.js` も `vite.config.ts` ではないので例外にならない。ディレクトリの位置は見ないので、どのワークスペースの `plugin.ts` / `vite.config.ts` でも同じく例外になる。

## なぜそれが要るか

守っている不変条件は「シンボル名が定義から呼び出しまで保たれる」ことである。

default export には名前がない。名前を決めるのは import する側であり、しかも import する側は好きな名前を選べる。同じ関数が、あるファイルでは `parseUser`、別のファイルでは `parse`、さらに別のファイルでは `userParser` として呼ばれる状態が、何の警告もなく成立する。

これが壊すのは読み手の検索である。定義を知っている人がその名前で grep しても、別名を付けた呼び出し側は引っかからない。呼び出しを読んでいる人がその名前で定義を探しても、定義は別の名前で書かれている。名前が対応関係を失うと、影響範囲の把握はファイルを 1 つずつ開く作業になる。

リネームも同じ理由で壊れる。named export なら定義側の名前を変えれば import 側が壊れて追随を強制されるが、default export では定義側の名前をいくら変えても import 側は無傷のまま古い名前を使い続ける。名前と実体がずれたことを何も検出しない。

例外にした 2 つのファイルは、この不変条件を捨てているのではない。default export を要求しているのが外部のツールであり、ファイル名そのものが役割を示しているため、名前が失われても指す先が一意に定まる。

## どう直すか

値に名前を付けて、その名前を export する。

```ts
export const parseUser = (input: string): User => JSON.parse(input) as User;
```

import 側は同じ名前で受け取る。

```ts
import { parseUser } from "./parse-user.ts";
```

`export default function foo() {}` のように既に名前が付いているなら、`default` を外して `export function foo() {}` にするだけで済む。無名の値を default export していたなら、まず名前を考えることになる。名前が決まらない値は、切り出す単位が間違っている可能性が高い。

## 禁じる回避策

- `export { foo as default }` と書く。`ExportDefaultDeclaration` ではないのでこのルールは報告しないが、import 側が任意の名前を付けられる点は `export default` と何も変わらない
- `export = foo` と書く。CommonJS 互換の構文に逃げているだけで、モジュール境界に名前が残らない点は同じ
- 例外を得るためにファイル名を `plugin.ts` や `vite.config.ts` に変える。ツールが読むエントリでないファイルにその名前を付けるのは、ファイル名が役割を示すという例外の前提そのものを壊す
- named export を 1 つ書いた上で default export を併置する。呼び出し側がどちらを使うかは選べるままなので、名前が保たれる保証は得られない

## オプション

取らない。有効か無効かだけを設定側で決める。
