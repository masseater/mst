# 0042. 呼び出し側が束を選び、選んだ束はルート全体に効く

- ステータス: Accepted
- 日付: 2026-08-12（2026-08-16 に改訂）
- [EDR 0032](0032-ship-the-cli-config-as-a-strict-superset.md) を supersede する

## 文脈

0032 は CLI パッケージ向けのルール 3 本を `oxlintCli` という上位集合として公開し、リポジトリ内ではその差分を `packages/dont-review-it/**` にだけ重ねると決めた。理由は依存の向きである。`standardIoTest` を出すのは `dont-review-it` で、その上流にある `lint-rule-authoring` の spec はそれを import できない。強制すると `vp run -r build` がタスクグラフの循環で落ちる。

この決め方には、決めた時点では見えていなかった代償があった。適用範囲がルートの `vite.config.ts` の glob として表現されるため、**範囲に載っていないパッケージが「意図した除外」なのか「載せ忘れ」なのかを、設定からは読めない**。実際 bin を公開する 5 パッケージのうち glob に載っていたのは 1 つだけで、残る 4 つは載せ忘れだった。CLI 向けルールは 4 パッケージに対して 1 度も走っていない。

規律が効いていない場所があること自体より、効いていないことが見えないことの方が重い。このリポジトリが機械で守ろうとしているのは「レビューで人間が同じ問いを繰り返さない」状態であり、範囲から外れた場所ではその問いが黙って人間に戻る。

当初この文脈から「preset を 1 枚に畳み、採用の判断を残さない」と決めた。その後、このパッケージを他のリポジトリが採る段になって、1 枚では粗すぎることが分かった。105 本のうち半分はテストの規律で vitest を前提にし、6 本は `@canonical-values` の注釈規約に乗ることを求め、いくつかは pnpm workspace や GitHub Actions を持つことを前提にする。それらを持たない採用者にとって、1 枚は「全部採るか、何も採らないか」になる。

## 決定

**`lint` は束を受け取り、名指しされた束のルールだけを配る。** 束は採用者が引き受ける不変条件の単位で、`all` を渡すと全部入る。公開する export は `dontReviewItPreset` の 1 つのままで、パッケージは分けない。

**選べない束を 1 つ置く。** `governance` は報告を消す経路を塞ぐルールを持ち、選択に関わらず必ず入る。選べるようにすると、その束を採らないことで他の全束をまとめて黙らせられる。`DECLARED_RULE_SETS` の構成員である `no-blanket-suppression` と `no-partial-rule-set` がこの束に入ることで、どの束を選んでも set が割れない。

**束の権威はルールの置き場ディレクトリに置く。** `src/lint/oxlint/rules/<束>/` に置かれたことが、そのルールがその束に属することを意味する。索引を書くのは `guard:fix` の `lint-rule-authoring check --write` で、検査するのは `guard:all` の `dont-review-it check` である。両者が同じ答えを出せる事実はファイルのパスしかない。preset の側に構成を持たせて索引へ渡す案は、書き手が構成を知らないまま索引を束無しの姿へ書き戻せる状態を残すので採らない。

**束の中では、範囲を切らない。** 選んだ束は呼び出した時点でリポジトリ全体に効き、対象種別による出し分けはしない。`no-citty-parent-run` は citty の `defineCommand` を、`require-standard-io-snapshot` は `standardIoTest` の import を見て自分で対象を絞るので、CLI でない場所では発火しない。対象を絞るのはルールの側である。

**`standardIoTest` は `@mst/dont-review-it` に残す。** 0032 が回避した循環は、上流の欠陥であってこのリポジトリの構造の問題ではない。pnpm はすべての依存種別から辺を張ったうえで循環したパッケージを 1 つのチャンクにまとめて実行し、既定では警告に留める。Turborepo も 2.4 でパッケージグラフの循環を許容するようになった。vite-task だけが非循環の実行グラフを要求して hard-error する。これは [vite-plus#1610](https://github.com/voidzero-dev/vite-plus/issues/1610) として起票され、[vite-task#411](https://github.com/voidzero-dev/vite-task/issues/411) で原因が特定され、[vite-task#414](https://github.com/voidzero-dev/vite-task/pull/414) が修正を出している。414 のテストフィクスチャは `devDependencies` の逆辺を明示的に対象にしており、このリポジトリの形そのものである。

上流に修正がある一時的な欠陥を避けるために、パッケージの構成を恒久的に組み替えない。fixture 専用パッケージの新設、`@mst/ai-native` への移設、`@mst/lint-rule-authoring` への移設をいずれも検討して捨てた。どれも憲章か公開面のどちらかを歪め、414 が入った後には不要になる。

**上流が直るまでの例外は 1 か所に閉じ、検査が報告する。** `packages/ai-native/**` と `packages/lint-rule-authoring/**` で `no-handmade-standard-io-double` だけを off にする。この 2 つは `dont-review-it` の上流にあり、fixture を import すると循環する。例外を設定に置いたまま黙らせるのではなく、適用範囲の検査が「preset のルールを off にしている override」として毎回報告する。

## 影響

**適用漏れと意図した例外が区別できるようになる。** 例外はゼロではないが、列挙され、理由が EDR にある。新たに誰かが override でルールを止めれば、同じ検査が同じ形で報告する。0032 の構成では、この 2 つが同じ「glob に無い」という見た目になっていた。

**「採っていない」と「採ったうえで止めた」も区別される。** 適用範囲の検査は、止めたルールを載せている束を採用者が名指ししていない場合、その override が何も止めていないことを別の文で報告する。

**`check` が採っていない束の検査を走らせなくなる。** CLI はツールチェーン設定から採用された束を読み、その束の検査だけを走らせる。走らせなかったものは一覧から消えず、理由を添えて 0 件として並ぶ。入口は `check` の 1 つのままである。

**束の名前は語彙として登録される。** 同じ綴りを別の概念が持っていると、その literal がすべて `no-strict-canonical-literal-use` の違反になる。`core`・`state`・`workspace` はこの理由で使えず、`writing`・`mutation-and-failure`・`toolchain` にした。ディレクトリ名としても、テスト専用ディレクトリの判定や走査の除外に捕まる語は使えない。

**414 が入ったら例外は消える。** 消す作業は override 1 件の削除と、対象 4 ファイルを `standardIoTest` へ移す変更だけである。`require-standard-io-snapshot` が両ストリームのスナップショットを要求するので、その追加も併せて要る。

**`apps/website` の例外も外した。** [EDR 0011](0011-fix-the-one-way-rules-and-what-they-cost.md) がスキャフォールド生成物として `no-array-mutation` と `no-reassign` を off にしていたが、[website の規約](../../apps/website/CLAUDE.md)は「lint ルールがこの場所のコードに当たったらコードの側を直す」と決めている。生成物をそのまま使う方針とルールに従うことは衝突しない。`counter.ts` の可変セルを属性に、`main.ts` の `innerHTML` 代入を `insertAdjacentHTML` に変えた。

**ルートの `overrides` に残るのは 2 件になった。** テスト用ディレクトリを禁じる `vitest/consistent-test-filename` と、上記の暫定的な例外である。
