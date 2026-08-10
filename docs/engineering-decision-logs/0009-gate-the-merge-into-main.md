# 0009. main への merge をフル検査で止める

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

[0002](0002-place-quality-gates.md) は検査を pre-commit・pre-push・CI の3段に置いた。この配置は、ブランチを push して CI を通し、そこから main に入るという前提に立っている。

このリポジトリのローカル運用はその前提を満たさない。ブランチは worktree で作られ、push されずにローカルの main へ直接 merge される。pre-push は発火せず、CI も走らない。結果として、main に入る唯一の経路である merge に検査が1つも無い。

pre-commit は staged ファイルに対する `vp check --fix` なので、リポジトリ全体の lint も、テストも、build も、未使用検出も見ていない。ブランチ側で緑を確認していても、merge した結果の木が緑である保証はない。main が動いていれば、merge 後の木はどちらのブランチにも存在しなかった状態になる。

## 決定

merge を4段目のゲートにする。走らせるのは `vp run ready`（CI と同じ内容）。

- **`package.json` の `prepare`** — `vp config` に続けて `git config merge.ff false`
- **`.vite-hooks/pre-merge-commit`** — `vp run ready`
- **`.vite-hooks/pre-commit`** — `vp staged` に続けて、merge の最中だけ `vp run ready`
- **`.vite-hooks/post-merge`** — merge 後の HEAD が merge commit でなければ、検査が走っていない事実を出力して非ゼロで終わる

## 根拠

git の merge がどのフックを呼ぶかを実測した（git 2.50.1）。対応する全フック名を仕掛けたスクラッチのリポジトリで、4通りの merge を実行した結果は次のとおり。

| merge の形                                             | 発火するフック                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| fast-forward                                           | `post-merge` / `post-checkout` / `post-index-change` / `reference-transaction` |
| 非 fast-forward・競合なし                              | `pre-merge-commit`                                                             |
| 非 fast-forward・競合あり（解決して `git commit`）     | `pre-commit`                                                                   |
| `pre-merge-commit` が非ゼロで終了した後に `git commit` | `pre-commit`                                                                   |

`pre-merge-commit` は4経路のうち1つしか押さえない。残る3つに対して、決定はそれぞれ別の手段を取っている。

### fast-forward は設定で消す

fast-forward を止められるフックが無い。上表の4つのうち非ゼロ終了で ref の更新を止められるのは `reference-transaction` だけで、`post-merge` の終了コードは無視される（実測でも `git merge` は exit 0 を返し ref は進んだ）。`reference-transaction` は Vite+ が dispatcher の shim を用意している14個のフック名に含まれず、置き場所の `.vite-hooks/_` は生成物かつ gitignore されているためリポジトリに入らない。加えてこのフックはコミットや checkout を含むあらゆる ref 更新で発火するため、フル検査を載せる場所として成立しない。

そこで fast-forward という形そのものを消す。`merge.ff false` を設定すると、fast-forward になるはずの merge が merge commit を作り、`pre-merge-commit` が発火する（実測で確認）。

この設定を `prepare` に置いたのは、規約ではなく機構にするため。`merge.ff` はリポジトリに入れられる設定ではないので、ドキュメントに「`--no-ff` を使う」と書く形では、書いた人以外の手元と、書いた人が忘れた場合に効かない。`prepare` は `vp install` のたびに走り、`vp config` が `core.hooksPath` を書くのと同じ経路で `merge.ff` も書く。フックが有効な手元では `merge.ff` も必ず設定されている状態になる。

### 競合と素通りは pre-commit で塞ぐ

競合した merge では `pre-merge-commit` は呼ばれず、解決後の `git commit` が `pre-commit` を呼ぶ。また `pre-merge-commit` が失敗しても merge は index と作業ツリーに残るため、続けて `git commit` すれば `pre-merge-commit` は再実行されずにコミットが作られる。どちらも `pre-commit` に同じ検査を置くことで塞がる。

merge の最中かどうかは `MERGE_HEAD` の存在で判定する。パスは `git rev-parse --git-path MERGE_HEAD` で解決する。worktree では `MERGE_HEAD` が `.git/worktrees/<name>/` の下に置かれるため、`.git/MERGE_HEAD` を直接見ると常に不在と判定され、ガードが常に素通りする。

### post-merge は設定が効いていない手元のためのバックストップ

`merge.ff false` は `--ff` を明示すれば上書きできる。`vp install` を一度も実行していない手元にも設定は無い。その場合 fast-forward の merge は検査を通らずに main を進めることになる。

`post-merge` はこれを黙って通さないために置く。merge 後の `HEAD` に第2親が無ければ fast-forward だったと判定できるので、その事実を出力し、事後の検査として `vp run ready` を走らせ、非ゼロで終わる。終了コードは git に無視されるため merge を取り消せないが、dispatcher が `VITE+ - post-merge script failed` を出すため見落とせない。

### 走らせる内容を `vp run ready` にした理由

push しない運用では CI が走らないため、merge が CI の代わりになる。`vp check` とテストだけでは build と未使用検出が漏れる。

## 影響

通常のコミットは変わらない。`pre-commit` の追加分は `MERGE_HEAD` があるときしか走らないため、merge 以外のコミットは今までどおり `vp staged` だけで完了する。

`merge.ff false` はこのリポジトリのすべての merge に効く。ブランチに `origin/main` を取り込むときも merge commit ができる。履歴には統合の時点が残る。

`vp run ready` が赤い状態では main への merge ができなくなる。ブランチ側で緑にしてから統合することになる。

`vp install` を実行していない手元にはフックも `merge.ff` も無い。この状態では `node_modules` が無いので `vp run ready` 自体が走らない。ゲートは `vp install` 済みであることを前提に置く。

## Vite+ 側の対応状況

`pre-merge-commit` と `post-merge` はどちらも Vite+ が対応しているフック名で、`vp config` が `.vite-hooks/_/` に dispatcher の shim を設置済み。対応するフック名は `SUPPORTED_GIT_HOOK_NAMES` として14個がバンドル内にハードコードされている。

したがって `.vite-hooks/` 直下にスクリプトを置くだけで効く。`vp config` の再実行も設定変更も要らない。shim は `.vite-hooks/<フック名>` が存在しなければ `exit 0` するため、ファイルの有無がそのまま有効・無効になる。
