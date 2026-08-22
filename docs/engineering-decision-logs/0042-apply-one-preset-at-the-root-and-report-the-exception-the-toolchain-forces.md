# 0042. preset は 1 枚をルートで適用し、ツールチェーンが強いる例外は検査が報告する

- ステータス: Accepted
- 日付: 2026-08-12
- [EDR 0032](0032-ship-the-cli-config-as-a-strict-superset.md) を supersede する

## 文脈

0032 は CLI パッケージ向けのルール 3 本を `oxlintCli` という上位集合として公開し、リポジトリ内ではその差分を `packages/dont-review-it/**` にだけ重ねると決めた。理由は依存の向きである。`standardIoTest` を出すのは `dont-review-it` で、その上流にある `ai-native`、`lint-rule-authoring`、`verified-specifications` の spec はそれを import できない。強制すると `vp run -r build` がタスクグラフの循環で落ちる。

この決め方には、決めた時点では見えていなかった代償があった。適用範囲がルートの `vite.config.ts` の glob として表現されるため、**範囲に載っていないパッケージが「意図した除外」なのか「載せ忘れ」なのかを、設定からは読めない**。実際 bin を公開する 5 パッケージのうち glob に載っていたのは 1 つだけで、残る 4 つは載せ忘れだった。CLI 向けルールは 4 パッケージに対して 1 度も走っていない。

規律が効いていない場所があること自体より、効いていないことが見えないことの方が重い。このリポジトリが機械で守ろうとしているのは「レビューで人間が同じ問いを繰り返さない」状態であり、範囲から外れた場所ではその問いが黙って人間に戻る。

## 決定

**`oxlintCli` を廃止し、公開面を `dontReviewItPreset` 1 つに畳む。** 3 本のルールは preset の `lint` 関数が返す設定に入れる。ルートの `lint` がその関数を呼んだ時点でリポジトリ全体に効き、採用の判断は残らない。

対象種別で切る必要はもともと無かった。`no-citty-parent-run` は citty の `defineCommand` を、`require-standard-io-snapshot` は `standardIoTest` の import を見て自分で対象を絞るので、CLI でない場所では発火しない。`no-handmade-standard-io-double` が守る「標準ストリームのテストダブルを spec ごとに組み立てない」は CLI に固有の規律ではない。

**`standardIoTest` は `@mst/dont-review-it` に残す。** 0032 が回避した循環は、上流の欠陥であってこのリポジトリの構造の問題ではない。pnpm はすべての依存種別から辺を張ったうえで循環したパッケージを 1 つのチャンクにまとめて実行し、既定では警告に留める。Turborepo も 2.4 でパッケージグラフの循環を許容するようになった。vite-task だけが非循環の実行グラフを要求して hard-error する。これは [vite-plus#1610](https://github.com/voidzero-dev/vite-plus/issues/1610) として起票され、[vite-task#411](https://github.com/voidzero-dev/vite-task/issues/411) で原因が特定され、[vite-task#414](https://github.com/voidzero-dev/vite-task/pull/414) が修正を出している。414 のテストフィクスチャは `devDependencies` の逆辺を明示的に対象にしており、このリポジトリの形そのものである。

上流に修正がある一時的な欠陥を避けるために、パッケージの構成を恒久的に組み替えない。fixture 専用パッケージの新設、`@mst/ai-native` への移設、`@mst/lint-rule-authoring` への移設をいずれも検討して捨てた。どれも憲章か公開面のどちらかを歪め、414 が入った後には不要になる。

**上流が直るまでの例外は 1 か所に閉じ、検査が warning として報告する。** `packages/ai-native/**`、`packages/lint-rule-authoring/**`、`packages/verified-specifications/**` で `no-handmade-standard-io-double` だけを off にする。この 3 つは `dont-review-it` の上流にあり、fixture を import すると循環する。rule、3 つの path、除外 path が無いことまで完全に一致するときだけ、適用範囲の検査が既知の例外として warning にする。それ以外の disabled rule は problem にする。

**preset を採用したという事実は静的に証明する。** `vite.config.ts` があるなら、`@mst/dont-review-it` の値 export `dontReviewItPreset` を静的 import し、root の `lint` からその `lint` 関数を object literal 1 つで直接呼ぶ。named import の alias と namespace import は同じ直接参照として扱う。raw object と `vite-plus` から静的 import した `defineConfig` だけを root config として解釈する。type-only import、別 module、dynamic import、local relay、computed member、spread、引数の欠落・追加・非 object、root `lint` の重複は、実行時に同じ値へなる可能性があっても採用の証明に使わない。

**静的に証明した公開 object は実行時にもすり替えられない形で渡す。** `dontReviewItPreset` と、severity の正規名を持つ `LINT_SEVERITY` は公開時に凍結する。設定評価中に関数や値を置き換えようとする操作は、preset を採用していない設定を静的な綴りだけで通すのではなく、設定の読み込み自体を失敗させる。

**preset rule を止めていないと証明できない設定は通過とみなさない。** root の `rules` と `overrides` を静的に読めない場合と、disabled preset rule を含む override の severity、`files`、`excludeFiles` を object literal と literal array から一意に読めない場合は problem にする。Oxlint が無効として扱う `off`、`allow`、数値 `0`、`LINT_SEVERITY.OFF` のような名前付き定数と、それらを先頭に置く配列を同じ disabled declaration として扱う。`vite.config.ts` 自体が無いリポジトリには preset の導入を要求しない。

## 影響

**適用漏れと意図した例外がゲートの結果で区別できるようになる。** 例外はゼロではないが、列挙され、理由が EDR にあり、完全一致だけが warning になる。新たに誰かが override でルールを止める、preset の `lint` 関数の直接呼び出しを外す、または静的に追えない形へ設定を変えると、同じ検査が problem として止める。0032 の構成では、この 2 つが同じ「glob に無い」という見た目になっていた。

**414 が入ったら例外は消える。** 消す作業は override 1 件の削除と、対象の手製 double を `standardIoTest` へ移す変更だけである。`require-standard-io-snapshot` が両ストリームのスナップショットを要求するので、その追加も併せて要る。

**`apps/website` の例外も外した。** [EDR 0011](0011-fix-the-one-way-rules-and-what-they-cost.md) がスキャフォールド生成物として `no-array-mutation` と `no-reassign` を off にしていたが、[website の規約](../../apps/website/CLAUDE.md)は「lint ルールがこの場所のコードに当たったらコードの側を直す」と決めている。生成物をそのまま使う方針とルールに従うことは衝突しない。`counter.ts` の可変セルを属性に、`main.ts` の `innerHTML` 代入を `insertAdjacentHTML` に変えた。

**ルートの `overrides` に残るのは 2 件になった。** テスト用ディレクトリを禁じる `vitest/consistent-test-filename` と、上記の暫定的な例外である。
