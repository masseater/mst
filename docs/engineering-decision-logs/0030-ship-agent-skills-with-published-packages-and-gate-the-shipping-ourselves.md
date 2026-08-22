# 0030. 公開パッケージに Agent Skill を同梱し、同梱の強制は自前の検査が持つ

- ステータス: Accepted
- 日付: 2026-08-11

## 文脈

このリポジトリのパッケージは AI エージェントが使う道具なのに、インストールしたエージェントに向けた知識を何も同梱していなかった。TanStack Intent は Agent Skills 標準の SKILL.md を npm パッケージに同梱して配布する仕組みを持ち、`intent list` / `intent load` で消費側のエージェントが発見できる。

同梱を強制する既製の検査を先に探した（[EDR 0024](0024-let-the-official-rule-stand-unless-its-message-cannot-decide-the-fix.md) の順序）。上流が持つのは 2 つで、どちらもゲートにならなかった。

- `intent validate` は packaging の不備（`files` の欠落、keyword の欠落）を warning として印字し、成功で終わる。このリポジトリの語彙では warning は人間に確認せず無視してよいものであり、強制ではない
- `intent stale` は skill を持たない公開ワークスペースを報告するが、npm レジストリへの照会を含み、レジストリが落ちていても成功で終わる報告ツールである。決定的なゲートに使えない

## 決定

**npm へ公開できる package.json を持つワークスペースは、TanStack Intent の skill を同梱する。** `private: true` でなく `name` を持つ manifest がその対象である。

**同梱の強制は `dont-review-it check` の検査として持つ。** マニフェストと skills/ ディレクトリをまたぐ検査なので、lint ルールではなく CLI の検査に置く（パッケージ規約どおり）。見るのは 3 点だけ。

- `skills/**/SKILL.md` が 1 つ以上ある
- `files` の許可リストがあるなら `skills` を載せている
- `keywords` が `tanstack-intent` を含んでいる

**検査は両方向に掛かる。** `private: true` のパッケージに同じ 3 点が書かれていれば、それも報告する。出荷されない skill は、それを発見したエージェントに存在しない配布面を教える。必要なものに無いことと、不要なものに有ることは、同じ食い違いの 2 つの面である。

**SKILL.md の中身の構造は上流の `intent validate` が持つ。** 各パッケージの `check:skills` スクリプトが呼び、`guard` が `vp run -r check:skills` で走らせる。frontmatter の形式・500 行制限・name とディレクトリの一致を自前で再実装しない。

**免除リストは持たない。** 上流は `_artifacts` の `coverage.ignored_packages` を読むが、この検査には付けない。公開するのに同梱しない選択肢を残すと、答えが一意に決まる問いでなくなる。免除が要る形が実際に現れたら、その時に上流と同じ形式を読む判断をする。

**成果物の置き場所は Intent の monorepo 規約に従う。** discovery の成果物（domain_map.yaml / skill_spec.md / skill_tree.yaml）はリポジトリルートの `_artifacts/`、SKILL.md と CHANGELOG.md は各パッケージの `skills/` に置く。`files` に `skills` を足すので、tarball には `skills/` 以下を同梱し、ルートの discovery 成果物は含めない。

## 影響

**導入時点で 3 つの公開パッケージすべてが skill を持つ。** 検査を足した commit で `@mst/dont-review-it` / `@mst/lint-rule-authoring` / `@mst/agentic-documents` に SKILL.md を書いたので、厳しい側へ移るときに既存の違反を抱えていない。後継の `@mst/repository-checks` は外部公開しないので `private: true` を維持し、検査の対象から外れる。公開側はこの内部契約を pack 時に成果物へ bundle し、private package 自体を consumer へ要求しない。

**`guard` に 1 行増えた。** `vp run -r check:skills`。検査の入口が増えたのではなく、上流ツールの構造検証を既存のゲートに載せただけである。同梱の有無は従来どおり `vp exec dont-review-it check` の 1 入口が落とす。

**このリポジトリの外でも効く。** `dont-review-it check` を採用したリポジトリは、公開パッケージに skill を同梱しない状態を残せなくなる。

**構造と配布の error gate は重ならない。** SKILL.md の構造は `intent validate`、同梱と配布の配線はこの検査が持つ。`intent validate` が packaging の不足を warning として併記する場合はあるが、この検査だけがその不足を error として止める。
