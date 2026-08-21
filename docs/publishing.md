# 公開

## 何が公開を決めるか

各パッケージのマニフェストの `version` が、そのパッケージの公開の宣言である。main に入った時点でその版がレジストリに無ければ、CI の `publish` job がその版を公開する。既にある版には何もしない。

公開したいパッケージの `version` だけを上げれば、そのパッケージだけが出る。上げなかったパッケージは、同じ main の変更に含まれていても公開されない。版を上げる操作そのものの規律は `AGENTS.md` が持つ。

依存の版は pack の時点で決まる。`workspace:*` は、そのとき作業ツリーにある依存の `version` へ書き換わる。依存と依存元を同じ変更で上げた場合、pnpm は依存を先に公開する。

## 認証

リポジトリは npm の token を持たない。`publish` job が GitHub Actions の OIDC token を npm へ渡し、npm がそれを短命の publish 権限と交換する。GitHub の secret にも `.npmrc` にも、寿命の長い資格情報を置かない。

公開された版には provenance が付く。pnpm が OIDC token とパッケージの可視性から自動で決めるため、ワークフローは `--provenance` を渡さない。

npm 側は、どのリポジトリのどのワークフローからの publish を受け付けるかをパッケージごとに持っている。これが Trusted Publisher の登録で、`ci.yml` というファイル名に紐づいている。ワークフローの名前を変えたら、登録も同じ変更で直す。

## 最初の 1 回だけ手元で行うこと

Trusted Publisher はレジストリに既にあるパッケージにしか登録できない。まだ存在しないパッケージに先回りして登録する経路を npm は持っていない（[npm/cli#8544](https://github.com/npm/cli/issues/8544) が OPEN のまま残っている）。そのため、パッケージを最初にレジストリへ置くところだけは手元から行う。

1. npm に `mst` organization を作る（<https://www.npmjs.com/org/create>）。他の誰かが `mst` を持っていた場合は、この先の手順ではなく各マニフェストの `name` のスコープを決め直すところからやり直す
2. `vp pm login` でログインする
3. `vp run -r build` でビルドする
4. `vp pm publish -r --no-git-checks` で、公開できるパッケージを現在の版のまま公開する
5. パッケージごとに Trusted Publisher を登録する

```console
$ npm trust github @mst/ai-native --file ci.yml --repo masseater/mst --allow-publish
```

この手順を終える前に main を push すると、`publish` job は認証を得られずに落ちる。まだレジストリに無い版を publish しようとして 401 で止まるためで、main が赤くなる。手順を終えた後は、既に公開した版を publish job が読み飛ばすので緑に戻る。

`npm` はこのリポジトリの中では起動しない。`devEngines.packageManager` が pnpm を要求していて、npm は `EBADDEVENGINES` で止まる。`npm trust` はホームディレクトリなど、リポジトリの外で実行する。

登録は `@mst/agentic-documents` `@mst/ai-native` `@mst/auto-develop` `@mst/dont-review-it` `@mst/lint-rule-authoring` `@mst/stop-ai-slop` `@mst/verified-specifications` に掛ける。登録した内容は `npm trust list <パッケージ名>` で読める。

## npm で publish しない

公開は `vp pm publish`（pnpm）で行う。npm の `publishConfig` はレジストリや access といった設定値しか上書きしないため、`npm publish` で出すと `bin` と `exports` が `./src/*.ts` を指したまま配られる。インストールした先の Node はその綴りを開けない。差し替えを pnpm に行わせる判断は [EDR 0066](engineering-decision-logs/0066-replace-the-published-entries-and-bundle-the-internal-contract.md) が持つ。
