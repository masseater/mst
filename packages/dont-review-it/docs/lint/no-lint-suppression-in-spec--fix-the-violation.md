---
description: "Disallow a lint suppression comment in the files these rules run on, so a report ends in a repair to the code or a repair to the rule and never in a comment that takes the report away"
---

# no-lint-suppression-in-spec--fix-the-violation

<!-- BEGIN GENERATED rule-header -->

Disallow a lint suppression comment in the files these rules run on, so a report ends in a repair to the code or a repair to the rule and never in a comment that takes the report away

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-lint-suppression-in-spec--fix-the-violation.ts`](../../src/lint/oxlint/rules/no-lint-suppression-in-spec--fix-the-violation.ts)

<!-- END GENERATED rule-header -->

## Violation

A comment in the file whose first token is a spelling that directs a lint suppression.

| What the suppression covers | Spelling |
| --- | --- |
| That line | `oxlint-disable-line` / `eslint-disable-line` |
| The next line | `oxlint-disable-next-line` / `eslint-disable-next-line` |
| The whole file, and the opening of a range | `oxlint-disable` / `eslint-disable` |
| The closing of a range | `oxlint-enable` / `eslint-enable` |

Whether rule names are listed is not a condition of detection. Where names are written the report carries them; where they are not, it says the suppression covers every rule the file is checked by. Whatever the names point at, and whether or not they belong to this bundle, it is reported.

Grounds written after `--` change nothing. What is held here is not "a suppression carries grounds" but "there is no suppression". Demanding grounds belongs to `no-silent-suppression--fix-or-justify-inline`, which watches the territory where a suppression can stand at all.

Whether the suppression actually silences anything is not a condition either. Residue whose direction reaches no report is reported the same way. The judgment reads the comment as tokens and does not interpret how far the suppression reaches. A range's closing end is reported on its own because a ranged suppression is written as two comments, and removing only the opening leaves the closing behind as residue.

No filtering by file kind is done. Which files this rule reaches is settled by the glob in the shared lint configuration.

### What is deliberately left out of reach

| Shape | Why it is not a target |
| --- | --- |
| `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | A direction to the type checker, not a lint suppression. Verifying type errors is part of what a test does |
| A comment opening with `mock-factory-exemption` | Not a direction the lint runner interprets, but a registration one rule reads. Whether to accept it is that rule's decision |
| Prose carrying a suppression spelling anywhere but the first token | The judgment reads the first token alone |
| A shebang | Its first token cannot be a suppression spelling |
| A suppression comment in a file outside the applied range | Outside the glob is outside this rule's jurisdiction |

### The invariant

No comment that erases a machine's output stands in a file the bundle's rules reach.

The first layer is what a reported spec is. Every rule in this bundle watches whether a test mirrors the implementation. A spec that raised a report is a spec that failed to mirror it, and a suppression removes that fact from the report while the failure stays in the code.

The second layer is how an erased report looks afterwards. To a reader skimming past the suppression comment, a spec that erased its report and a spec that never violated anything look the same. This bundle uses a green lint as evidence of the discipline. As long as a route exists for a writer to selectively erase the machine's output, green is not evidence.

The third layer is what a suppression comment brings into the code. A suppression is a negotiation — "let this one through" — and the only place to push back is a review. Not having to raise the same question in review again is what this package is for, so leaving a place for that negotiation works against the purpose.

### Configuration

None. Whether the rule is on or off is settled by the configuration, and nothing else about the judgment is.

No setting expresses a conditional exception. Such a setting is itself a new suppression channel, moving the negotiation out of the code and into a configuration file. If there is a file where a suppression should stand, that is a question about the applied range, and the range is watched by `require-spec-lint-coverage--lint-every-spec-file`.

## Fix

Fix the violation being reported. If it cannot be fixed, then the rule's detection is picking up something that is not a violation, so fix the rule's specification. Those two are the only ways a report ends.

Deleting the suppression comment is settled mechanically, so an automatic fix is offered that deletes it. The fix removes the comment's range alone. Once deleted, the reports it had been silencing stand again, and that is the correct state.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// grounds written after the separator leave the suppression standing
// oxlint-disable-next-line forbid-weak-matcher--use-exact-matcher -- the matcher reads a floating clock
it("adds", () => {
  expect(runSut()).toBe(3);
});
```

```ts
// the closing end of a suppression range is reported on its own
it("adds", () => {
  expect(runSut()).toBe(3);
});
/* oxlint-enable forbid-weak-matcher--use-exact-matcher */
```

Code this rule accepts.

```ts
// a line direction to the type checker is not a lint suppression
// @ts-ignore the parse rejects this shape
const row = readRow(1);
```

```ts
// prose naming a directive spelling past the opening token passes
// this spec used to carry an oxlint-disable comment
it("adds", () => {
  expect(runSut()).toBe(3);
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Placing a blanket suppression naming no rule at the head of the file. Whether names are there is not a condition of detection
- Writing grounds after `--` and keeping the suppression. Whether grounds are there is not a condition either
- Removing only the opening of a range and leaving the closing comment. The closing is reported on its own
- Placing a suppression naming this rule. Names are not a condition, so it is reported exactly like any other
- Renaming the suppression spelling and registering that alias as a suppression in the lint configuration. The registered spelling surfaces on the configuration side, where `require-spec-lint-coverage--lint-every-spec-file` compares the range against the settings
- Moving the suppression into an exclusion on the configuration side, whether a per-file disable or a rule set to off. `require-spec-lint-coverage--lint-every-spec-file` fails it where it lands

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `namedSuppression` | A \`{{spelling}}\` comment must not stay in this file. It takes away what {{silenced}} reports. Delete the comment, then rewrite the code that report stands on, or narrow what that rule detects. Nothing else settles a report. |
| `blanketSuppression` | A \`{{spelling}}\` comment naming no rule must not stay in this file. It takes away what {{silenced}} reports. Delete the comment, then rewrite the code those reports stand on, or narrow what those rules detect. Nothing else settles a report. |
| `suppressionRangeEnd` | A \`{{spelling}}\` comment must not stay in this file. It closes the range a suppression comment opens. Delete both ends of that range, then rewrite the code the reopened reports stand on, or narrow what those rules detect. Nothing else settles a report. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
