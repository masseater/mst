# 0057. 検査にリポジトリが強制している綴りを読ませ、仕様担保テストの lint 設定を preset の側へ移す

- ステータス: Accepted
- 日付: 2026-08-14

## 文脈

lint 設定の棚卸しをした。preset が配る 106 本のうち有効化していない 2 本と、`off` にしている 6 か所を数え、判断がどこにあるかを追った。`no-mixed-package-surface--declare-one-surface` と `require-spec-or-assets-only-in-spec-directory--move-out-or-inline` を有効にしないことは登録のコミットが、`no-version-range--pin-the-exact-version` を preset に載せないことは [EDR 0041](0041-let-the-declaration-decide-the-release.md) が、`specs/**` で `no-detached-test-file--move-beside-source` を止めることは [EDR 0039](0039-let-the-specifications-bundle-guard-the-specs-directory-alone.md) が既に決めていた。判断の抜けは 1 件も無かった。

抜けていたのは、`off` を見張る側だった。`vp exec dont-review-it check` の preset-adoption は `0 problems 0 warnings` を返し続けていた。ルートの設定に `off` が無いからではない。`disabled-rule-declarations.ts` が重大度を `Literal` ノードとしてしか読まず、ルートが書く `LINT_SEVERITY.OFF` は `MemberExpression` だったためである。しかもこの綴りは `no-strict-canonical-literal-use--use-canonical-import` が強制しているもので、検査が読める `"off"` のほうを lint が禁じている。読める綴りと書ける綴りが交わっていなかった。

[EDR 0042](0042-apply-one-preset-at-the-root-and-report-the-exception-the-toolchain-forces.md) は、上流が直るまでの例外について「例外を設定に置いたまま黙らせるのではなく、適用範囲の検査が『preset のルールを off にしている override』として毎回報告する」と書いている。その報告は一度も出ていなかった。ルートの 1 行を `"off"` に書き換えると、同じコミットのまま 2 件の警告が現れる。

同じ棚卸しで、`@mst/verified-specifications` の import される面が `oxlint` 設定 1 本だけであることも分かった。その設定の中身は `dont-review-it/no-detached-test-file--move-beside-source` という、依存宣言に無いパッケージのルール名の名指しである。依存の向きは `@mst/dont-review-it` から `@mst/verified-specifications` への一方向で、参照はその逆に走っていた。この設定を読む箇所はリポジトリに 1 つしかなく、それが `@mst/dont-review-it` の preset である。

## 決定

**重大度の綴りを、束の検査と同じ語彙で読む。** `Literal`、静的な `MemberExpression`、`[水準, 設定]` の先頭の 3 形を読み、`off` / `allow` / `0` を無効として扱う。語彙の表は `no-partial-rule-set--enable-the-whole-set` が使っているものをそのまま借り、2 つ目の表を作らない。同じ設定を読む 2 つの検査が別々の綴りを理解する状態を残さないためである。

**仕様担保テストの lint 設定を `@mst/dont-review-it` の preset へ移す。** [EDR 0039](0039-let-the-specifications-bundle-guard-the-specs-directory-alone.md) の「仕様担保テストの規律は `@mst/verified-specifications` が配る lint 設定と検査コマンドが持っている」のうち、lint 設定の部分を取り消す。射程の分担そのものは変えない。`specs/` の下の `.spec.ts` がテスト規律の束の射程外であることも、`specs` の外に置いた `.spec.ts` を報告することも、そのまま残る。移すのは設定の置き場所だけである。

**`@mst/verified-specifications` を実行される面だけのパッケージにする。** 公開エントリと `src/index.ts` を落とし、`bin` だけを宣言する。このパッケージが人間に配るのは `SPECIFICATIONS.md` を生成する検査コマンドであって、import される値ではない。

## なぜ設定を持つ側へ寄せるのか

ルール名は、そのルールを持つパッケージの語彙である。名指しだけを別のパッケージへ置くと、名前が変わったときに壊れる側と直す側が分かれる。依存宣言があれば型もパッケージマネージャも見張るが、lint 設定のルール名は文字列なので、宣言の無い辺は誰も見ていない。

逆向きの辺を消す方法は 2 つあった。`@mst/verified-specifications` から `@mst/dont-review-it` への依存を宣言する道は、既にある逆向きの依存と合わせて循環になる。設定を持つ側へ移す道は辺を 1 本減らす。減らすほうを採った。

## 影響

**ルートの `off` が毎回報告されるようになった。** `packages/ai-native` と `packages/lint-rule-authoring` に対する 2 件で、EDR 0042 が書いた挙動と一致する。理由は同じ EDR にあるので、警告は残したまま読める。

**`@mst/dont-review-it` から `@mst/verified-specifications` への依存が消えた。** preset が `extends` する設定は 2 つになり、パッケージの依存グラフから辺が 1 本減った。

**`@mst/verified-specifications` から `oxlint` と `@mst/lint-rule-authoring` の依存も消えた。** どちらも移した設定だけが使っていた。

**`specs/` に対する lint の結果は変わらない。** 移設の前後で `vp check` を走らせ、23 件の `.spec.ts` がどちらでも報告されないことを確かめた。名前の綴りの要求とソース隣接の要求の解除は、preset の `overrides` の末尾で同じ順に効いている。

**主張が 3 つから 2 つになった。** 移した `lint-preset.spec.ts` は 3 つ目の `it` が 1 つ目と同じ対象を確かめていたので、2 つに畳んで `@mst/dont-review-it` の `specs/toolchain-preset.spec.ts` へ移した。

## 検討して採らなかった案

**`@mst/verified-specifications` を `@mst/dont-review-it` へ畳む。** 2 つのパッケージは目的が逆を向いている。前者は AI の仕様解釈を人間が読める形に出す道具で、後者はレビューで人間が問い直さずに済む状態を作る道具である。畳むと、名前が約束していることの中に反対向きの道具が入る。加えて guard は 4 本の検査コマンドを同じ形で並べており、そのうち 1 本だけを畳む理由が説明できない。[EDR 0033](0033-dissolve-the-catch-all-utils-and-keep-only-the-check-contract.md) が解体したものへ戻る道でもある。

**`no-detached-test-file--move-beside-source` の射程外判定を、設定ではなくルールの実装へ移す。** `require-spec-lint-coverage--lint-every-spec-file` が既にその形を持っているので、揃えれば `overrides` が 1 つ減る。採らなかったのは、射程が変わるためである。今の設定は `specs/` の下のすべてを対象から外していて、実装へ移すと `.spec.ts` だけになる。今日のリポジトリでは同じ結果になるが、範囲を変えるかどうかは設定の置き場所とは別の判断であり、同じ変更で混ぜない。

**検査が読む綴りを `"off"` のままにし、ルート側の書き方を変える。** `no-strict-canonical-literal-use--use-canonical-import` が禁じている。検査のために lint を曲げる形になる。
