# Lint rules this package ships

Every rule below is registered at error severity unless the table says the preset leaves it off. Generated from the rule implementations; regenerate with `vp run guard:fix` rather than editing it.

<!-- BEGIN GENERATED shipped-lint-rules -->

| Rule | What it rejects | Notices |
| --- | --- | --- |
| [forbid-symbol-prefixed-name--rename-to-alphanumeric-start](https://github.com/masseater/mst/blob/main/packages/lint-rule-authoring/docs/lint/forbid-symbol-prefixed-name--rename-to-alphanumeric-start.md) | Require every directory and file name on the path of a linted file to start with a letter or a digit, so nothing sits where a glob walk never reaches it | ⚙️ |
| [no-broad-lint-disable--use-next-line-with-reason](https://github.com/masseater/mst/blob/main/packages/lint-rule-authoring/docs/lint/no-broad-lint-disable--use-next-line-with-reason.md) | Require every lint suppression to apply to the next line alone, so code written later never inherits an exemption nobody chose for it |  |
| [no-explained-lint-message--state-prohibition-then-fix](https://github.com/masseater/mst/blob/main/packages/lint-rule-authoring/docs/lint/no-explained-lint-message--state-prohibition-then-fix.md) | Require every lint message to carry a prohibition and an imperative repair direction and nothing else, so the first thing a reader meets is the action that clears the report |  |

Notices — 🔧: fixes itself / 💡: offers an editor suggestion / ⚙️: reads options

<!-- END GENERATED shipped-lint-rules -->
