# 0051. 宣言ファイルの出力をゲートの独立した段として走らせる

- ステータス: Accepted
- 日付: 2026-08-13

## 文脈

`unabridged` の hook 定義（[EDR 0050](0050-refuse-output-slicing-at-the-moment-of-execution.md)）を足したところ、`vp pack` が TS4023 を 2 件出した。公開する `hook` の型が cc-hooks-ts の `HookContext` と `PreToolUseHookOutput` を参照しているのに、その 2 つが export されていないため宣言ファイルに名前を書けない、という報告である。

このとき `vp run guard` は緑だった。3 つの実測でその理由が分かった。

- `vp check` は「型エラー無し」と報告する。`vp check` の型検査は [tsgolint](https://github.com/oxc-project/tsgolint) による型を見る lint であり（[公式ドキュメント](https://viteplus.dev/guide/check)）、宣言ファイルを出力しない。declaration emit でしか出ないエラーは原理的に視野の外にある
- `vp pack` は同じファイルで 2 件を報告するが、終了コードは 0 である。ゲートの `vp run -r build` はこれを失敗として受け取らない
- 各ワークスペースの tsconfig は `declaration: true` を既に持っている。設定が足りないのではなく、その設定を使って出力する走行がゲートに無い

つまり、公開パッケージの型宣言が壊れていてもゲートは緑を返す。このリポジトリが最も嫌う形（[EDR 0026](0026-give-the-checks-one-entry-that-fails.md)、`docs/guidelines/enforcement.md`）がここにあった。

## 決定

**宣言ファイルの出力を、ゲートの独立した段として走らせる。** 各ワークスペースに `typecheck` を置き、ルートの `guard:all` が `vp check` の直後に `vp run -r typecheck` を呼ぶ。前置きは下位の層の規約（[EDR 0036](0036-fix-the-wrapper-prefix-per-layer-and-check-it-where-manifests-are-checked.md)）に合わせて `spool -- ` にする。

**走らせるのは `tsc` である。** ツールチェーンを Vite+ に一本化する規約から外れるが、Vite+ はこの検査を持たない。`vp check` は tsgolint で、`vp pack` は報告しても止まらない。上流の tsdown も [rolldown/tsdown#933](https://github.com/rolldown/tsdown/issues/933) で「tsdown は型検査器ではない、`tsc` を併走させろ」と回答しており、この形は上流の指示そのものである。`typescript` は既に全ワークスペースの devDependency で、`apps/website` は `build:all` の中で素の `tsc` を呼んでいる。新しい道具は増えない。

**`apps/website` には置かない。** `build:all` が既に `tsc` を通しており、置くと同じ検査が 2 回走る。

## 影響

**ゲートの段が 1 つ増えた。** 導入時点で 9 つのワークスペースすべてが `tsc -p .` で緑だったので、既存のコードに手当ては要らなかった。所要は 1 ワークスペースあたり 1 秒未満である。

**この段が検出するのは型検査ではなく宣言の出力である。** 通常の型エラーは引き続き `vp check` が捕まえる。両者は重なるが、重なっていない部分がこの段を足した理由なので、片方を消すことはできない。

**`typecheck` は前置きの検査の対象外である。** `dont-review-it check` が固定文字列を要求するのは `test`・`build`・`check` の 3 つで、`typecheck` は名前が違うため見られない。前置きを外した定義が入っても報告されない。検査の対象名を増やすかは、この段が定着してから決める。

**新しいワークスペースを足すときは `typecheck` も足す。** 無いワークスペースは `vp run -r typecheck` から静かに外れる。この漏れは機械では止まらない。
