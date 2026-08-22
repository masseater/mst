# 0045. 欠かせないファイルの形を検査で要求する

- ステータス: Accepted
- 日付: 2026-08-13

## 文脈

リポジトリには、無いと運用が成り立たないファイルがいくつかある。道具の設定と、AI 向けの指示がそれにあたる。これらは中身が正しいかどうかの前に、置かれている形そのものが決まっている。

道具の設定は `vite.config.ts` に集約する規約があり、集約できない道具については綴りが決まっていなかった。knip の設定は `knip.json` に置かれていて、型検査もフォーマッタも lint も届かない場所にあった。knip が読む綴りは `knip.json` / `knip.jsonc` / `.knip.json` / `.knip.jsonc` / `knip.ts` / `knip.js` / `knip.config.ts` / `knip.config.js` の 8 つで、TypeScript の綴りは読める（`node_modules/knip/dist/constants.js` の `KNIP_CONFIG_LOCATIONS`）。読めるのに読ませていなかった。

同じ穴は oxlint・eslint・vite にもある。どれも JSON や JavaScript の綴りを受け付ける。受け付ける以上、誰かが置けばそのまま効く。効いているのに検査系が一切見ない設定が生まれる。

AI 向けの指示は `AGENTS.md` を実体、`CLAUDE.md` をそこへのシンボリックリンクとして 10 か所に置いてある。この形は誰も機械で確かめていなかった。片方をコピーで置き換えても、リンクを別の先へ向けても、どの検査も何も言わない。指示が 2 通りある状態は、読み手ごとに違う規範が配られることを意味する。

## 決定

`dont-review-it check` に `required-file-form` を足す。リポジトリの根と `package.json` を持つディレクトリを開き、そこに置かれるファイルが要求された形かどうかだけを見る。中身は読まない。

道具の設定については、その道具自身が読む綴りのうち型検査が届かないものを列挙し、存在したら報告する。列挙は一次情報から取る。knip は `KNIP_CONFIG_LOCATIONS`、vite は `DEFAULT_CONFIG_FILES`、oxlint はネイティブバインディングが持つ文字列（`.oxlintrc.json` / `.oxlintrc.jsonc` / `oxlint.config.ts` / `oxlint.config.mts`）、eslint は flat config の `FLAT_CONFIG_FILENAMES` と v8 が文書化した `.eslintrc` の優先順である。

移し先は道具ごとに設定へ書く。oxlint と vite は `vite.config.ts`、knip は `knip.ts`、eslint は `eslint.config.ts` になる。oxlint の移し先を `oxlint.config.ts` にしないのは、その綴りを [AGENTS.md](../../AGENTS.md) が禁じているからである。報告が禁じられた場所へ誘導しては、直し方が一意にならない。

AI 向けの指示については、`AGENTS.md` と `CLAUDE.md` の対を見る。`AGENTS.md` があって `CLAUDE.md` が無い、`CLAUDE.md` が実体ファイルである、`CLAUDE.md` が `AGENTS.md` 以外を指している、`CLAUDE.md` だけがあって `AGENTS.md` が無い、の 4 つを報告する。

どれも警告ではなく問題として出し、終了コードに数える。どの報告も直し方が 1 つに決まるためである。

knip の設定は `knip.ts` に移す。`knip.json` は消す。knip の解決順は JSON を TypeScript より先に見るので、両方を残すと TypeScript の側が死んだまま残る。

## 帰結

- knip の設定が型検査・フォーマッタ・lint の対象になった。`KnipConfig` に合わない記述はコミット前に落ちる
- `knip.ts` は default export を要求されるので、`no-default-export--use-named-export` の `toolRequiredFileNames` に綴りを足した
- oxlint・eslint・vite の設定を JSON や JavaScript で置く経路が塞がった。TypeScript の綴りは通る
- `CLAUDE.md` を実体ファイルに戻す変更、別の先へ向ける変更が落ちるようになった
- 検査対象の綴りは道具のバージョンに追随しない。道具が新しい綴りを読み始めても、この検査は知らないままになる
- 走査は 1 ディレクトリあたり固定回数の `stat` で済む。ディレクトリの中を列挙しない

## 検討して採らなかった案

**lint ルールとして書く。** 判定に要るのはファイルの存在とシンボリックリンクの指す先であって、ファイルの構文ではない。lint のツールチェーンは JSON や YAML の設定ファイルを対象に取らないし、リンクの実体も見ない。[@mst/dont-review-it](../../packages/dont-review-it/AGENTS.md) の分担どおり CLI の検査になる。

**設定の検査とシンボリックリンクの検査を別々の観点として並べる。** 走査するディレクトリの集合が同じで、見ているのも「置かれるべきものが置かれるべき形か」の一点である。分けると、同じ走査を 2 回行い、走査証跡にも同じ数が 2 行並ぶ。

**綴りを網羅せず、拡張子が TypeScript でないファイルを片端から報告する。** 道具が読まない綴りまで報告することになる。`knip.schema.json` のような、名前は似ていても道具が読まない置き物を落とすのは、直しようのない報告になる。

**oxlint の移し先を `oxlint.config.ts` にする。** その綴りは禁じられている。検査が禁止先を指す状態は、規約が 2 つに割れたのと同じである。

**`vitest.config.ts` や `.oxfmtrc.json` も対象に足す。** どちらも [AGENTS.md](../../AGENTS.md) が既に文章で禁じている。この検査が持つのは「TypeScript の外に設定を置かない」という不変条件であって、「その道具の設定ファイル自体を作らない」ではない。2 つを 1 つの検査に混ぜると、報告が指す規約がどちらなのか読めなくなる。
