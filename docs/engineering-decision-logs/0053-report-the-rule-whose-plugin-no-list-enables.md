# 0053. プラグインを有効にしていないルール名を報告する

- ステータス: Accepted
- 日付: 2026-08-13

## 文脈

oxlint の設定では、有効にするプラグインの一覧と、重大度を与えるルールの一覧が別々の宣言になっている。このリポジトリでは前者が `UPSTREAM_PLUGINS`、後者が `UPSTREAM_RULES` で、同じファイルに並んでいながら互いを参照していない。

`UPSTREAM_PLUGINS` から `import` の 1 行を抜いて実測した。`UPSTREAM_RULES` が `error` で名指ししている `import/default`、`import/export`、`import/namespace`、`import/no-named-as-default`、`import/no-named-as-default-member` の 5 本が解決後の設定から消え、ルールは 255 本から 250 本になった。終了コードは 0 のままで、警告も報告も出なかった。

消えたルールは「違反が無かった」と区別が付かない。[0018](0018-narrow-the-export-surface-to-what-is-used.md) と [0016](0016-enforce-with-upstream-rules-before-writing-our-own.md) が記録した「宣言されているだけで何も止めていない検査」と同じ形で、片側の宣言を削る変更は何も落とさずに通る。

同じ形は preset をまたいでも成立する。`@mst/verified-specifications` は `vitest` のルールを 2 本 `error` で名指ししているが、`vitest` プラグインを有効にしているのは `@mst/dont-review-it` の側である。依存の向きは `dont-review-it` から `verified-specifications` へ向いているので、名指しする側が有効化を確認する経路を持たない。

## 決定

**lint ルールで止める。** 判定に要るのは、その場に書かれたルール名と、有効なプラグインの一覧だけである。[強制の機構](../guidelines/enforcement.md)が「複数の機構が同じだけ確実に守れるなら、失敗が返るまでの距離が短いほうを採る」と定めており、lint の失敗は pre-commit で返る。

**有効なプラグインの一覧は preset がオプションとして配る。** ルールのオプションへ名前を書き写すと、実際に有効化している宣言とは別の出どころができる。抜かれた名前がオプションに残り、報告が出なくなる。preset が `UPSTREAM_PLUGINS` をそのまま渡すことで、一覧から消えた名前はオプションからも消える。

**同じファイルに書かれた `plugins` と `jsPlugins` も有効化の根拠として読む。** ルートの `vite.config.ts` は自分で `vite-plus` の js プラグインを宣言しており、その名前を preset のオプションへ持ち上げると、呼び出し側の宣言が二重表現になる。

## 棄却した候補

**型で縛る。** `UPSTREAM_RULES` のキーを `UPSTREAM_PLUGINS` の要素から導く型にすれば、抜いた瞬間に型検査が落ちる。失敗が返る距離は lint より短い。採らなかったのは、届く範囲が宣言と同じワークスペースに閉じるためである。`verified-specifications` が名指しする `vitest` のルールは、依存の向きが逆で `UPSTREAM_PLUGINS` を参照できず、この形では守れない。守れない範囲を残したまま主たるガードにすることを[強制の機構](../guidelines/enforcement.md)が禁じている。

**解決後の設定を突き合わせる検証コマンド。** `vp lint --print-config` が返すのは解決の済んだ姿で、消えたルールはそこに現れない。消えたことを知るには消える前の宣言が要るので、材料は結局ソースの側にある。同じ材料を読むなら、失敗が返るまでの距離が長い側を選ぶ理由が無い。

## 受け入れたもの

重大度が `off` のルールは報告しない。無効化するだけならプラグインは要らない。この判断により、`verified-specifications` が `dont-review-it` のルールを 1 本 `off` にしている宣言は、js プラグインの有効化を確認せずに通る。

計算されたキーで書かれたルール名は読まない。preset 自身がルールを有効にしている `${PLUGIN_NAME}/${rule.name}` の形はこれに当たり、このルールの視界の外にある。自前ルールの名前が自分のプラグイン名から組み立てられている限り、両者がずれることはない。
