# 0017. git の ignore 設定を lint と fmt に配る

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

git がファイルを無視する経路は 3 つある。リポジトリの `.gitignore`、`$GIT_DIR/info/exclude`、`core.excludesFile` が指すマシン全体の ignore である。oxlint と oxfmt が歩くとき尊重するのは 1 つ目だけだった。

実測で確かめている。`.gitignore` に載っている `dist/` の下に違反ファイルを置くと lint は素通りするが、グローバルの ignore に載っている `.agents/` の下に同じファイルを置くと報告される。`vp fmt --list-different` も同じく `.agents/` の中身を整形対象として並べた。

このリポジトリではエージェントの作業ディレクトリ（`.agents/`、`.local-agents/`、`.claude/plans/` など）をグローバルの ignore で無視している。それらがそのまま lint と format の対象になっていた。format に至っては、無視しているはずのディレクトリの中身を書き換える。

差を埋める口は oxlint / oxfmt の `ignorePatterns` しかない。CLI には `--ignore-path` があるが、設定から指定する経路は無い。

## 決定

**git の 3 経路を読んで `ignorePatterns` に変換し、`withGitExcludes` が設定へ注入する。** 順序はグローバル → `$GIT_DIR/info/exclude` → リポジトリの `.gitignore` とする。gitignore は last-match-wins であり、git 自身の優先順位もこの並びである。順序を変えると、リポジトリ側の `!.vscode/settings.json` のような再包含がグローバル側の指定に負ける。

リポジトリの `.gitignore` は oxlint が既に尊重しているため、この経路の取り込みは重複する。それでも読むのは、3 経路の優先順位を 1 か所で組み立てないと、上の再包含のような経路をまたぐ関係を表現できないためである。

**`ignorePatterns` は preset から配れないので、ラッパを公開する。** oxlint は `extends` で名指しした設定が持つ `ignorePatterns` を捨て、`extends` を書いた側の設定に書かれたものだけを使う（`Oxlintrc::merge` が `self` の `ignore_patterns` だけを残す）。preset に `ignorePatterns` を書いても 1 件も効かないことは実測で確認しており、同じ 1 行をルートの `vite.config.ts` に移した瞬間に効いた。`rules` / `overrides` / `plugins` / `options` は継承されるので、この 1 フィールドだけが例外になっている。

したがってパターン列は `defineConfig` に直接渡すオブジェクト自身が持つしかない。`withGitExcludes` はその 1 点だけを担い、preset は今までどおり `extends` の中に置く。

**忘れたことを機械が報告する。** `no-unwrapped-toolchain-config--wrap-with-git-excludes` を base preset に error で入れた。ラッパを忘れても lint は緑のまま通り、無視されるはずのファイルが静かに増えるだけなので、人間が気づく契機が無い。

**`oxfmt` を直接依存にした。** ラッパは `lint` と `fmt` の両方を受けるため、`OxfmtConfig` の型が要る。`oxlint` を直接依存にしているのと同じ理由で、catalog に vite-plus が解決するのと同じ版（0.61.0）を置いた。`vp why oxfmt` が単一インスタンスであることを確認している。

## 影響

**lint と format の対象がマシンの設定に依存するようになった。** グローバルの ignore は開発者ごとに違い、CI には無い。同じコミットに対して、手元では無視され CI では検査されるファイルが生まれうる。

これは受け入れる。逆向き（CI で無視され手元で検査される）は起きないため、CI の網が緩むことはない。無視されるのは各自のスクラッチ置き場であり、リポジトリが追跡しているファイルではない。追跡しているファイルを手元だけ検査から外すには、そのファイルをグローバルの ignore に書くことになるが、それは git の追跡自体を歪める行為であって、この機構が新たに開けた抜け道ではない。

**`vp check` の対象がリポジトリ 1 つ分だけ縮んだ。** 実測では `.agents/` の下のファイルが lint と fmt の両方から消え、追跡しているファイルの報告は変わっていない。

**設定の読み込み時に git を 2 回呼ぶ。** `git rev-parse` と `git config --type=path --get core.excludesFile` である。git が無い、リポジトリの外にいる、ファイルが存在しないといった場合はいずれも空のパターン列に落ちる。設定の読み込みで失敗させない。

## 検討して採らなかった案

**`overrides` で無視したいパスのルールを全部 off にする。** `overrides` は `extends` で継承されるため preset から配れる。採らなかったのは、`overrides` に `categories` が無く、`correctness` を error に上げた組み込みルールを消せないためである。除外の代わりにならないうえ、ファイルは読まれ続ける。

**preset を「完成した設定」にして `lint: dontReviewIt.oxlint` と書かせる。** これならラッパは要らない。採らなかったのは、`apps/website` 向けの override のようなこのリポジトリ固有の設定まで、公開するパッケージ側へ移すことになるためである。

**ルート側に `ignorePatterns: gitExcludePatterns()` と 1 行書く。** 何が起きているかは最も明示的だが、ignore の配線を利用側が意識し続けることになる。ラッパなら、忘れた場合にルールが報告する。

**グローバルの ignore を `.gitignore` に書き写す。** 書いた時点の写しでしかなく、各自の設定はそれぞれ違う。リポジトリの `.gitignore` は追跡しないファイルの宣言であって、各開発者の作業道具の置き場を並べる場所ではない。
