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

A property in a lint configuration object whose key names one of the off-the-shelf rules that read what they reject from their own configuration, held at a severity that runs. `off`, `allow` and `0` are not running; `error`, `deny`, `warn`, `1` and `2` are, and so is a bare entry whose severity cannot be read.

Where the rule has a designated receiver, the report names it. Where it has none, the report asks for a rule that names the shape it rejects and the repair it demands. `restrictionRules` adds a rule to the list, and `exceptions` registers one that stays, carrying the grounds it stays on; an entry with no grounds is reported.

## Fix

Move each ban into the rule that carries its replacement, so the ban stands in one place the other checks can read. Where no such rule exists yet, write one that states the rejected shape and the repair.

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
export default { lint: { rules: { "dont-review-it/forbid-declared-module-import--use-declared-replacement": ["error", { restricted: [{ module: "lodash" }] }] } } };
```

```ts
// a registered exception carrying grounds is the path this rule leaves open
// in vite.config.ts
export default { lint: { rules: { "no-restricted-syntax": "error" } } };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Lowering the entry to `warn`. A running severity is a running severity
- Registering the rule in `exceptions` without grounds. The entry is reported until they are written
- Spelling the rule name with a plugin prefix. The match runs on the name after the last `/`

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
