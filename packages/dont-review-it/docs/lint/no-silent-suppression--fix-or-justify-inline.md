---
description: "Require every report from the rules that keep one declaration in one place to end in a repair, a registered deviation, or a suppression that carries its grounds, so what the linter stops saying is a decision somebody wrote down"
---

# no-silent-suppression--fix-or-justify-inline

<!-- BEGIN GENERATED rule-header -->

Require every report from the rules that keep one declaration in one place to end in a repair, a registered deviation, or a suppression that carries its grounds, so what the linter stops saying is a decision somebody wrote down

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `governance`
- Source: [`no-silent-suppression--fix-or-justify-inline.ts`](../../src/lint/oxlint/rules/governance/no-silent-suppression--fix-or-justify-inline.ts)

<!-- END GENERATED rule-header -->

## Violation

A report from one of the guarded rules ending anywhere but a repair, a registered deviation, or a suppression carrying its grounds. Six shapes are reported.

- A suppression covering a guarded rule with no grounds after `--`
- One reaching past the line below it, so anything but the next-line spelling
- One naming this rule itself
- A configuration holding a guarded rule at a level that leaves a run green
- An ignore pattern naming a place outside the regions this repository declares as excluded from the walk
- An ignore pattern covering a path registered as forbidden

`guardedRules`, `excludedRegions` and `forbiddenPaths` settle those three lists.

## Fix

Rewrite the code the rule reports, or register the deviation in the list that rule keeps.

Where a suppression genuinely stands, write it as `oxlint-disable-next-line` above the one line, name the rule, and write its grounds after `--`.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a next-line suppression of a guarded rule without grounds is reported
// oxlint-disable-next-line no-duplicate-exported-type--reuse-authoritative-type
export type Cart = { readonly total: number };
```

```ts
// a whole-file suppression of a guarded rule is reported even with grounds
/* oxlint-disable no-duplicate-exported-type--reuse-authoritative-type -- the generator writes both copies */
export type Cart = { readonly total: number };
```

Code this rule accepts.

```ts
// a next-line suppression carrying grounds is the path this rule leaves open
// oxlint-disable-next-line no-duplicate-exported-type--reuse-authoritative-type -- the generator writes both copies from one schema
export type Cart = { readonly total: number };
```

```ts
// a suppression naming only rules outside the guarded set is another rule's business
// oxlint-disable-next-line no-console
console.log(1);
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Widening the suppression to the file so one comment covers everything below it
- Lowering the rule in the configuration instead. A green run is what the lowering buys
- Adding an ignore pattern over the path the report stands on

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `groundlessSuppression` | A \`{{spelling}}\` comment covering {{covered}} must not stand without grounds. Rewrite the code that rule reports, register the deviation in the list that rule keeps, or write after \`--\` what makes this line an exception. |
| `wholeFileSuppression` | A \`{{spelling}}\` comment covering {{covered}} must not reach past the line below it. Rewrite the code that rule reports, register the deviation in the list that rule keeps, or replace this comment with \`oxlint-disable-next-line\` above the one line, naming the rule and writing its grounds after \`--\`. |
| `selfSuppression` | A suppression naming \`{{ruleName}}\` must not stay in the source. Rewrite the code the covered rule reports, or register the deviation in the list that rule keeps. |
| `weakenedRule` | A lint configuration must not hold \`{{ruleName}}\` at \`{{severity}}\`, a level that leaves a run green. Set it to \`error\`, rewrite the code that rule reports, or register the deviation in the list that rule keeps. |
| `undeclaredIgnoredRegion` | An ignore pattern must not name \`{{pattern}}\`, a place outside the regions this repository excludes from the walk. Delete the pattern and rewrite the code it hides, or declare the region in the definition this configuration receives. |
| `ignoredForbiddenPath` | An ignore pattern must not cover \`{{forbiddenPath}}\`, a path registered as forbidden. Delete the pattern, and delete that file or move it to the place its owner names. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
