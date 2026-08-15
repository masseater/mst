---
description: "Require every file declaring a test block to sit inside the reach of the spec discipline bundle, with those rules failing a run and their shared settings handed out from one declaration, so a run that reports nothing stands apart from a bundle that reaches nothing"
---

# require-spec-lint-coverage--lint-every-spec-file

<!-- BEGIN GENERATED rule-header -->

Require every file declaring a test block to sit inside the reach of the spec discipline bundle, with those rules failing a run and their shared settings handed out from one declaration, so a run that reports nothing stands apart from a bundle that reaches nothing

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`require-spec-lint-coverage--lint-every-spec-file.ts`](../../src/lint/oxlint/rules/require-spec-lint-coverage--lint-every-spec-file.ts)

<!-- END GENERATED rule-header -->

## Violation

A file, a configuration entry or a setting that puts the spec discipline bundle out of reach. Six reports.

- A file declaring a test block while its name ends with none of the spec suffixes
- A file carrying a spec file name while binding a test-vocabulary word to something outside the runner's API
- A bundle rule held at a level that does not fail a run, with or without an override scope
- An ignore entry covering an authored spec file
- A setting more than one rule reads sitting in the options of a single rule entry, leaving every other reader on its default

## Fix

Rename the file to end with one of the spec suffixes, or move the declaration into a file that already does.

Set every bundle rule to `error`, narrow an ignore pattern to the generated paths it stands for, and hand a shared setting to every reader from one declaration.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a source file that declares a test block sits outside the reach of this bundle
// in packages/cart/src/basket.ts
it("counts the basket", () => { expect(1).toBe(1); });
```

```ts
// a bundle rule taken down to a level that passes a run is reported
// in vite.config.ts
export default { lint: { rules: { "dont-review-it/require-test-block-spelling--use-configured-fn": "off" } } };
```

Code this rule accepts.

```ts
// a spec file that declares a test block sits inside the reach of this bundle
// in packages/cart/src/basket.test.ts
it("counts the basket", () => { expect(1).toBe(1); });
```

```ts
// a bundle rule held at the level that fails a run passes
// in vite.config.ts
export default { lint: { rules: { "dont-review-it/require-test-block-spelling--use-configured-fn": "error" } } };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Lowering one bundle rule to `warn`, or scoping it away with an override
- Putting the spec under an ignore entry
- Writing a shared setting into one rule's options so the others keep their defaults

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `uncoveredSpecFile` | A file that declares a test block must not carry a name outside the spec file names this bundle reads. This declaration is rooted at \`{{blockName}}\`, and this file name ends with none of {{specSuffixes}}. Rename this file to end with one of them, or move the declaration into a file that already does. A green run of the other rules of this bundle stands for nothing while a file holding test blocks stays out of their reach. |
| `unrelatedFileInScope` | A file that binds \`{{boundName}}\` to a value outside the test runner API must not carry a spec file name. Rename \`{{boundName}}\` to a word outside the test vocabulary, or rename this file to end with none of {{specSuffixes}}. |
| `disabledBundleRule` | A lint configuration must not hold \`{{ruleName}}\`, a rule of the spec discipline bundle, at \`{{severity}}\`. Set that entry to \`error\` and rewrite the code the rule reports. A green run of this bundle stands for nothing while one of its rules stays quiet. |
| `scopedDisabledBundleRule` | An override must not take \`{{ruleName}}\` down to \`{{severity}}\` over {{scope}}. Delete that entry and rewrite the code the rule reports over those paths. A green run of this bundle stands for nothing while its rules stay quiet over part of the tree. |
| `ignoredSpecFile` | An ignore entry must not cover a file this bundle reads. \`{{pattern}}\` covers \`{{matchedPath}}\`, an authored spec file. Narrow that pattern to the generated paths it stands for, or delete it and rewrite the code the bundle reports. A green run of this bundle stands for nothing while a spec file sits under an ignore entry. |
| `settingWrittenPerRule` | A setting that more than one rule reads must not sit in the options of a single rule entry. \`{{settingKey}}\` sits in the options of \`{{ruleName}}\`, and every other reader of that setting keeps its own default. Delete that entry and hand the value to every reader from one declaration. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
