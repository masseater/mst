# Lint rule index

Every lint rule this workspace implements. Generated from the rule sources; refresh it with `vp run guard:fix` rather than editing it.

<!-- BEGIN GENERATED lint-rules -->

| Rule | Description | Tool | Notices |
| --- | --- | --- | --- |
| [forbid-symbol-prefixed-name--rename-to-alphanumeric-start](./forbid-symbol-prefixed-name--rename-to-alphanumeric-start.md) | Require every directory and file name on the path of a linted file to start with a letter or a digit, so nothing sits where a glob walk never reaches it | oxlint | ⚙️ |
| [no-broad-lint-disable--use-next-line-with-reason](./no-broad-lint-disable--use-next-line-with-reason.md) | Require every lint suppression to apply to the next line alone, so code written later never inherits an exemption nobody chose for it | oxlint |  |
| [no-explained-lint-message--state-prohibition-then-fix](./no-explained-lint-message--state-prohibition-then-fix.md) | Require every lint message to carry a prohibition and an imperative repair direction and nothing else, so the first thing a reader meets is the action that clears the report | oxlint |  |

Notices — 🔧: fixable / 💡: suggestions / ⚙️: options

<!-- END GENERATED lint-rules -->
