# lint ルール索引

このワークスペースの自前 lint ルールの一覧。ルール実装から生成される。手で書き換えない。更新は `vp run guard:fix` で行う。

<!-- BEGIN GENERATED lint-rules -->

| ルール                                                                                                                      | 説明                                                                                                                                                                          | ツール | 補足 |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---- |
| [forbid-symbol-prefixed-name--rename-to-alphanumeric-start](./forbid-symbol-prefixed-name--rename-to-alphanumeric-start.md) | Require every directory and file name on the path of a linted file to start with a letter or a digit, so nothing sits where a glob walk never reaches it                      | oxlint | ⚙️   |
| [no-broad-lint-disable--use-next-line-with-reason](./no-broad-lint-disable--use-next-line-with-reason.md)                   | Require every lint suppression to apply to the next line alone, so code written later never inherits an exemption nobody chose for it                                         | oxlint |      |
| [no-explained-lint-message--state-prohibition-then-fix](./no-explained-lint-message--state-prohibition-then-fix.md)         | Require every lint message to carry a prohibition and an imperative repair direction and nothing else, so the first thing a reader meets is the action that clears the report | oxlint |      |

補足の記号 — 🔧: 自動修正あり / 💡: エディタの修正候補あり / ⚙️: オプションあり

<!-- END GENERATED lint-rules -->
