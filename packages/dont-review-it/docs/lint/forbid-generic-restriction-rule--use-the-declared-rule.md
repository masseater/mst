---
description: "Disallow enabling an off-the-shelf lint rule that reads what it rejects from its own configuration, so every ban this repository declares stands in the rule that carries its replacement and reaches the checks that read the bans"
---

# forbid-generic-restriction-rule--use-the-declared-rule

<!-- BEGIN GENERATED rule-header -->

Disallow enabling an off-the-shelf lint rule that reads what it rejects from its own configuration, so every ban this repository declares stands in the rule that carries its replacement and reaches the checks that read the bans

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`forbid-generic-restriction-rule--use-the-declared-rule.ts`](../../src/lint/oxlint/rules/forbid-generic-restriction-rule--use-the-declared-rule.ts)

<!-- END GENERATED rule-header -->

## Violation

An off-the-shelf rule that takes what it rejects from its own configuration array, standing enabled in the configuration.

Which rule names are targets is carried by a table, eight rows by default, whose values live in the rule itself. Each row holds the off-the-shelf rule's name and the rule of this package that receives its bans, and some rows carry no receiver.

The unit that is read is one object property. A property whose key, after the last `/`, matches a name in the table and whose value is not written as disabled is reported. A spelling carrying `eslint/` or `typescript/` and one carrying no prefix point at the same row.

Because the unit is one property, where it is written makes no difference. The `lint.rules` of the root `vite.config.ts`, the `lint.overrides[].rules` beside it, and the `UPSTREAM_RULES` carved out into `packages/dont-review-it/src/configs/upstream-rules.ts` all have the same shape. Adding a layer or carving it into another file puts the report in the same place.

Values are read four ways:

- `off`, `allow` and `0` pass as disabled. In the `[severity, settings]` form the head is read, and a member of a named constant such as `LINT_SEVERITY.OFF` is read as the severity through its member name
- `error`, `deny`, `warn`, `1` and `2` are enabled and reported. `warn` does not pass, because as long as a report comes out the ban is written there
- An expression that cannot be read as a severity — a binding from elsewhere, a call, an object — is reported. Only being written as disabled stops a report
- A string that is none of the above is not read. Even in a table whose keys are rule names, a value outside the severity vocabulary means this is not a table that reaches the linter

### The invariant

The first layer is that an off-the-shelf rule can only carry a ban as one free string. The ban, why the ban is needed, and what to use instead are three separate pieces of information, and only the ban can be carried structurally. The replacement does not travel, so whoever receives the report settles the substitute on the spot, and how it gets settled scatters across call sites.

The second layer is that a configuration inheriting from another and rewriting the same key replaces the whole array. Bans declared upstream vanish silently, and their vanishing is reported nowhere. A configuration with one ban fewer and a configuration that never had a ban have the same shape in the output.

The third layer is that other checks stand on the bans living in one place. This package externalises bans into the table of each rule and carries checks that take those tables as their input. An off-the-shelf rule's array is not part of that input, so the moment bans split across two places, the reconciliation stops being able to claim it reads all of them. That premise breaking is indistinguishable from the check being green.

It is also a matter of distance. Adding one line to an off-the-shelf rule's array is shorter than adding an entry to a dedicated rule's table. The shorter route gets taken, so rather than guarding the longer one with a norm, the shorter one is closed.

### Where detection does not reach

A severity given through the linter's launch arguments, an editor's settings, or a specification added in an individual CI step never appears in a file of the repository and cannot be read. An upstream rule implementation republished under another name looks, from the configuration side, like a different rule.

A row registered in `exceptions` whose corresponding entry has disappeared cannot be reported by this check, because there is nowhere to report it. Taking stock of dead registrations belongs to the check that reconciles each table's rows against the range that consumes them.

### Configuration

- `restrictionRules` (optional, a list of `{ rule, substitute }`): the table of off-the-shelf rules that take bans from a configuration array. Rows written here are **added** to the eight defaults rather than replacing them, so that removing the defaults cannot be written as one configuration line whose only visible result is that nothing is reported. A row with no `substitute` is treated as a row with no receiver
- `exceptions` (optional, a list of `{ rule, reason }`): off-the-shelf rules allowed to stand enabled, with the grounds. Empty by default. A row whose `reason` is empty or whitespace alone is reported

```jsonc
[
  "error",
  {
    "exceptions": [
      { "rule": "no-restricted-syntax", "reason": "no rule of our own names this shape yet" },
    ],
  },
]
```

There is no way to replace the default table wholesale. With replacement available, there would be no way to read, from the side that lost them, how many of this package's default bans disappeared.

## Fix

Move the bans written in the off-the-shelf rule's array into the entries of the rule the table names. Write the replacement instruction as you move them: that is the information the off-the-shelf rule could not carry, and moving without it means whoever receives the next report settles the substitute all over again. Once moved, delete the off-the-shelf entry rather than leaving it disabled.

The destination is not always the one rule the report names. An off-the-shelf rule can sometimes ban two different units at once, and `no-restricted-imports` is that case: rows banning a whole module go to the module-level receiver, and rows banning particular names from a module go to the export-level receiver. What the report names is the unit that rule mainly bans.

Where the row carries no receiver, write that rule. One rule whose name says what it rejects and how to fix it puts the bans back in one place.

Only where neither is available, register it in `exceptions`. A registration needs grounds: write what makes that ban impossible to express as a rule of this package. A registration with no grounds is reported.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a listed rule enabled in the lint configuration names where its bans belong
// in vite.config.ts
export default { lint: { rules: { "no-restricted-imports": ["error", { paths: ["lodash"] }] } } };
```

```ts
// a rule left at a level that only warns still holds the ban
// in vite.config.ts
export default { lint: { rules: { "no-restricted-globals": "warn" } } };
```

Code this rule accepts.

```ts
// this package's own rules carry their bans in their own options
// in vite.config.ts
export default {
  lint: {
    rules: {
      "dont-review-it/forbid-declared-module-import--use-declared-replacement": [
        "error",
        { restricted: [{ module: "lodash" }] },
      ],
    },
  },
};
```

```ts
// a registered exception carrying grounds is the path this rule leaves open
// in vite.config.ts
export default { lint: { rules: { "no-restricted-syntax": "error" } } };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Registering the off-the-shelf rule under another name to get through. A spelling that only changed the plugin prefix is matched after the last `/` and does not pass. Republishing an upstream rule implementation under another name is indistinguishable from the configuration side, and it is an act of hiding where the bans live rather than something permitted
- Splitting the configuration and writing the enablement into a file that is not checked. The unit is one property, so the same shape is read wherever it was carved out to
- Escaping the severity into a binding outside the configuration file so it cannot be read. An unreadable expression is reported as not being written as disabled
- Removing the row from the table to get through. At that moment, the bans written in that off-the-shelf rule stop being reconciled by anything
- Writing an empty-looking string in the grounds of an `exceptions` entry to satisfy the shape. Whitespace alone is reported, and a plausible-looking string with no content cannot be told apart by a machine

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `redirectedRestrictionRule` | A lint configuration must not enable \`{{ruleName}}\`, a rule that reads what it rejects from its own configuration. Move each entry to \`{{substitute}}\` together with the replacement it names, or register \`{{ruleName}}\` in this rule's \`exceptions\` option with the grounds it stays. |
| `undelegatedRestrictionRule` | A lint configuration must not enable \`{{ruleName}}\`, a rule that reads what it rejects from its own configuration. Write a rule that names the shape it rejects and the repair it demands, or register \`{{ruleName}}\` in this rule's \`exceptions\` option with the grounds it stays. |
| `groundlessRestrictionException` | A registered exception must not stand without grounds. \`{{ruleName}}\` carries none. Write the grounds into that entry, or delete the entry and move each ban to the rule that receives it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
