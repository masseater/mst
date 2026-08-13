# 0044. skill の隣に changelog を同梱し、マニフェストの版と突き合わせる

- ステータス: Accepted
- 日付: 2026-08-13

## 文脈

[EDR 0030](0030-ship-agent-skills-with-published-packages-and-gate-the-shipping-ourselves.md) で、npm へ公開できるパッケージは TanStack Intent の skill を同梱すると決めた。同梱されているかは検査が見ている。同梱されたものが、その版に追随しているかは誰も見ていなかった。

SKILL.md の frontmatter は `metadata.library_version` を持つ。値は手で書かれていて、`package.json` の `version` と揃っているかを判定するものが無い。版だけ上げて古い skill を出荷する経路が開いている。

publish はまだ始めていない。始めてからこの穴に気づくと、既に配られた tarball が嘘を持つ。

上流は同じ問題に別の答えを持っている。`intent setup` が置くワークフローのテンプレートは、release が published になったのを合図に `intent stale` を走らせ、更新が要る skill があれば bot が review PR を開く。EDR 0030 が既に `intent stale` について「レジストリへの照会を含み、レジストリが落ちていても成功で終わる報告ツールで、決定的なゲートに使えない」と決めている。加えてこの形は publish の後に直すもので、配られた版に古い skill が入ることを防がない。

## 決定

**版に追随しているかを、リポジトリの中のファイル同士の突き合わせだけで判定する。** git の履歴もレジストリも読まない。読むと「前回の版」を知るために外部の状態が要り、検査が落ちる理由が実行した環境に依存する。

npm へ公開できるマニフェスト（`private: true` でなく `name` と `version` を持つ）に対して:

- `skills/CHANGELOG.md` がある
- その changelog が、マニフェストの `version` を見出し（`## <version>`）として持つ
- 同梱する各 `SKILL.md` の `metadata.library_version` が、マニフェストの `version` と一致する

`private: true` のマニフェストには逆向きに掛ける。changelog があれば報告する。EDR 0030 が置いた「必要なものに無いことと、不要なものに有ることは同じ食い違いの 2 つの面である」をそのまま適用した。

**changelog は人が書く。** 機械は見出しの有無だけを見て、中身は見ない。コミットログからの生成は採らない。このリポジトリのコミットログは実装者に向けた理由を持つもので、パッケージを入れる側に向けた変更の記述とは読み手が違う。

**自動修正は `library_version` の同期だけにする。** マニフェストの `version` から一意に決まるため。changelog の見出しは対象にしない。見出しだけ機械が足すと、中身が空のまま検査が通り、書くべき人が書いていない状態を機械が隠す。

**`version` を持たないマニフェストには何も言わない。** publish されないものに publish の規律を掛けても、直し方が決まらない。

## skill の差分を要求しない理由

「版を上げた変更では SKILL.md も変わっていること」を要求する形も考えられる。採らない。

版を上げても skill の記述が変わらないことは実際にある。修正が skill の書いていない層に閉じていれば、書き足すことは何も無い。それでも差分を要求すると、書くことがないのに本文をいじる操作が発生し、その操作は skill を良くしない。

changelog の見出しなら、書くことは必ずある。版を上げた以上、上げた理由が存在する。要求が空振りしない側に不変条件を置いた。

## この検査が守れないこと

changelog に書かれた内容が本当かどうかは見ない。skill の本文が実装と合っているかも見ない。どちらも判定が機械に落ちない。

守れるのは「版を上げたのに何も書かなかった」と「skill が別の版を名乗ったまま出荷される」の 2 つで、いずれも書き手が手を止めれば必ず踏む。

## publish を始める時に決めること

この変更は publish の前提を整えるもので、publish そのものは含まない。始める時点で次の 3 つを決める。

- **公開の経路。** npm に `@mst` スコープが無い。npm の classic token は 2025-12-09 に恒久廃止されているので、[Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)（OIDC）が前提になる。organization の作成と Trusted Publisher の登録は npm の Web 側の操作で、リポジトリの中で完結しない。動かせないワークフローを先に置いても、置いた形が正しいかを確かめられない
- **`@mst/repository-checks` の公開。** 公開する 7 パッケージのうち 6 つが `workspace:*` で依存していて、`private: true` のままでは publish が通らない（依存していないのは `@mst/ai-native` だけで、これは単独で出せる）。`@mst/dont-review-it` へ畳む案は循環する。`@mst/lint-rule-authoring` が `readUnlessMissing` を使い、`dont-review-it` がその `lint-rule-authoring` を 20 箇所を超えて使っているためで、[EDR 0033](0033-dissolve-the-catch-all-utils-and-keep-only-the-check-contract.md) が同じ理由で畳むのを見送っている
- **pnpm と OIDC の組み合わせ。** [pnpm/pnpm#11513](https://github.com/pnpm/pnpm/issues/11513) が pnpm 11 での 404 を報告し、`pnpm/action-setup` を更新して解消したとして CLOSED になっている（2026-05-08）

## 影響

**検査の入口は増えていない。** `intent-skills` という既存の観点が見るものが増えただけで、`dont-review-it check` の 1 入口が落とす形は変わらない。

**版を上げる操作と changelog を書く操作がひとつになった。** 版だけ動かすことができなくなる。

**`--write` が直す対象が 2 つになった。** マニフェストの入口スクリプトと、同梱する skill の版である。どちらもリポジトリが自分で決めている値で、書き手が判断する余地が無い。

**7 つの公開パッケージすべてが 0.0.0 の changelog を持った。** 厳しい側へ移る時点で既存の違反を抱えていない。
