# no-partial-coverage-source-universe--include-production-files

## 何を検出するか

basename が `vite.config` または `vitest.config` で、拡張子が `.js` / `.cjs` / `.mjs` / `.ts` / `.cts` / `.mts` であるファイルが、production source の glob を `test.coverage.include` に文字列リテラルで宣言していない状態を検出する。`eslint.config` や `playwright.config`、任意名の config factory は対象にしない。test command の `--config` / `-c` は CLI の検査が禁じるため、lint と test runner は同じ canonical config を読む。

既定で要求する glob は `src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}` である。別の source root を持つリポジトリは、ルールの `include` オプションで要求する glob の集合を置き換える。要求した glob はすべて設定に必要で、それ以外の glob が一緒に書かれていてもよい。

設定の default export は object literal そのものか、`vite` / `vite-plus` / `vitest/config` から value import した `defineConfig` へ object literal 1 個を渡す形に限る。named import の alias と namespace import は import binding から解決する。type-only import、同名のローカル関数、別 module からの import は config factory とみなさない。default export、factory 引数、`test`、`coverage`、`include` を包む TypeScript の `as` / `satisfies` / non-null / angle-bracket assertion は実行時の値を変えないため透過して読む。

root、`test`、`coverage` の spread・動的な computed property、`mergeConfig`、変数、関数の返り値、複数引数は、後から `include` や `exclude` を上書きできるため動的設定として報告する。`include` は文字列リテラルだけの array literal に限る。CommonJS の `.cjs` / `.cts` と、`module.exports` を使う `.js` は静的な ESM resolver の外へ設定を置くため、内容を推測せず ESM への変換を報告する。

`run.tasks.test` は `package.json#scripts.test` の検査を通らず別の test command を実行できるため報告する。変数、spread、computed property で `run.tasks` の有無を隠す構成も報告する。test の入口は package script の bare `vp test` に置く。

`include` 内の `!` で始まる否定 glob と、`coverage.exclude` は、いずれも明示した source universe からファイルを引けるため報告する。ルールオプションの必須 glob も空文字・否定 globを schema で受け付けない。

## なぜそれが要るか

カバレッジの下限が 100 でも、分母がテスト中に import されたファイルだけなら、新しい未検証ファイルは分母へ入らない。そのファイルにテストが一つも無いほど、レポートから完全に消え、下限を下げずに検査を通過できる。

`coverage.include` は、テストから到達したかどうかとは別に production source の集合を先に決める。その集合に入った未 import ファイルは 0% として現れ、既存の `no-lenient-coverage-threshold--demand-full-coverage` が要求する file 単位の下限を通過できなくなる。include と threshold の片方だけではこの状態を作れない。

`coverage.exclude` と否定 include は、include が作った分母から任意のファイルを引ける。同じ設定に許すと、検査対象を宣言した直後に例外で戻せるため許可しない。

設定の対象は canonical な `vite.config` / `vitest.config` に限定する。任意名の設定まで lint が推測すると、ESLint や Playwright の config を誤って coverage config とみなす。一方、test command の `--config` / `-c` と coverage override は CLI が package script を検査して止める。lint は canonical config の静的宣言、CLI は実行時の選択経路を持ち、両方が揃って同じ設定を検査と実行に使わせる。

`run.tasks.test` を禁じるのも同じ理由である。Vite config 内の task は package script の検査対象にならず、そこへ `--coverage=false` や別設定の選択を置ける。設定を lint できても、実際の test command が別の分母を選べるなら source universe の保証にはならない。

このルールが保証するのは source universe の宣言であり、テストの assertion が振る舞いを十分に確かめることではない。実行された行と分岐は coverage が測るが、期待値の正しさはテストが持つ。

## どう直すか

production source が `src` にあるなら、test config に次を置く。

```ts
coverage: {
  include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"],
}
```

source root が異なる場合は、実際の root を覆う glob を設定へ書き、同じ集合をルールの `include` オプションへ渡す。

独自の `coverage.exclude` がある場合は削除する。production でない生成物や fixture が include に入っているなら、exclude で引くのではなく、production source だけを指すよう include の root を狭める。

`coverage` が静的な object literal で、`include` が無いか文字列だけの array literal で不足している場合、自動修正が必須 glob を追加する。動的構成、否定 glob、`exclude` は、安全な source root と削除範囲が一意に決まらないため自動修正しない。

CommonJS config は `vite.config.ts` または `vitest.config.ts` へ改名し、`vite` / `vite-plus` / `vitest/config` の `defineConfig` を ESM で import して default export する。`run.tasks.test` は削除し、package manifest の `scripts.test` に bare `vp test` を置く。

## 禁じる回避策

- import されたファイルだけで下限を満たす。未 import ファイルが分母へ入らず、このルールが防ぐ状態そのものが残る
- production source を `coverage.exclude` へ足す。数字だけが上がり、未検証コードは残る
- include を変数や共有設定から流し込む。test config だけでは対象集合が確定せず、変更時に分母が動いたことを読めない
- spread、computed property、`mergeConfig` で静的な include の後から設定を上書きする
- include に否定 glob を足して個別ファイルを差し引く
- CommonJS の config へ同じ設定を移して静的検査から外す
- `run.tasks.test` へ test command を置いて package script の config / coverage override 検査を迂回する
- 要求された glob を、実在する production source を覆わない別の glob に置き換える。ルールオプションと設定を同時に狭めれば構文上の報告は消えるが、source universe は欠けたままになる

## オプション

`include` は、test config に要求する glob の配列である。既定は `src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}` の一つ。空配列と重複は受け付けない。
