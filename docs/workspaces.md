# ワークスペース

このリポジトリが持つワークスペースの一覧。`pnpm-workspace.yaml` の宣言と各ワークスペースのマニフェストから生成される。手で書き換えない。更新は `vp run guard:fix` で行う。

<!-- BEGIN GENERATED workspaces -->

- `apps/website` — The Vite+ dev-server target of this repository.
- `packages/agentic-documents` — AI-facing documents that stay true to the repository and keep a shape machines can follow.
- `packages/dont-review-it` — Machine-enforced answers to the writing questions that would otherwise be raised in review.
- `packages/lint-rule-authoring` — Materials for authoring lint rules that keep working after they are written.
- `packages/utils` — The neutral home for declarations that more than one package needs and none of them owns.
- `packages/verified-specifications` — Specifications extracted from the tests that verify them, so a human can read what the AI believes the code promises.

<!-- END GENERATED workspaces -->
