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

Whether the group of rules holding the way tests are written — this bundle, below — reaches every file declaring a test block, and stands there at a severity that fails a run. Both the side it does not reach and the side it must not reach are read. There are four reports.

These are the rules of the bundle.

- `require-test-block-spelling--use-configured-fn`
- `forbid-it-extend--use-test-extend`
- `no-vitest-context-expect--import-expect-from-vitest`
- `no-computed-test-api-member--use-static-member`
- `no-test-context-escape--destructure-fixtures-by-name`
- `no-expect-synthetic-subject--yield-from-fixture`
- `no-fixture-construct-in-use--yield-sut-output`
- `no-fixture-copy-subject--yield-sut-output`
- `no-fixture-forward-subject--yield-sut-output`
- `no-fixture-factory-function--inline-owned-setup`
- `require-vitest-extend-builder--infer-fixture-type`
- `no-lint-suppression-in-spec--fix-the-violation`
- `require-spec-lint-coverage--lint-every-spec-file`

### What is missed

A file declaring a test block while carrying no spec file name. Reported as `uncoveredSpecFile`.

The rules of this bundle read the file name themselves and work only on files ending in `.test.ts` and `.test.tsx`. Where the name does not match, not one report comes out. A test block declaration is a call handed a string title and a callback, rooted at the spelling `it` or `test`, at a binding imported from the test runner (a renamed import included), or at a binding derived from one of those. A form carrying a modifier such as `it.each(...)` reads as the same declaration.

Where the same name is bound by a declaration in that file itself, it is not read as a declaration. A file giving the name another meaning — `const it = (title: string, run: () => void): void => { run(); };` — declares no test block.

`.spec.ts` and `.spec.tsx` under a `specs` directory are not reported. The discipline of specification-holding tests belongs to the lint configuration and the check command that `@mst/verified-specifications` ships, and being outside this bundle's reach is the correct state for them. A file of the same spelling standing outside `specs` is reported, since it reaches neither bundle.

### What is swept in

A file carrying a spec file name while using none of the test runner's vocabulary and binding `it` / `test` / `expect` to another meaning. Reported as `unrelatedFileInScope`.

Counted as a binding: a variable, function or class declaration whose initialiser is a function, a class, a literal, an object or an array, or which carries no initialiser at all. The same name appearing in a member's property position is no binding (`RuleTester.it` is nothing to this rule).

Nothing is reported where any of these stands: one test block declaration, an import of these names, or a call on one of these names where that name is bound to no other meaning. A spec where not one test block has been written yet is not reported.

### Being turned off

A state where the lint configuration places a rule of this bundle at a severity that does not fail a run. Reported when the configuration file (`vite.config.*`) is checked.

- `disabledBundleRule`: directly under `rules`, a rule of this bundle sits at `off` / `warn` / `allow` / a number below 2
- `scopedDisabledBundleRule`: one of the `overrides` does the same after cutting a range with `files`. The report carries that range
- `ignoredSpecFile`: one line of `ignorePatterns` covers a spec file that exists. The covered file's path is carried

`ignorePatterns` is matched against the paths obtained by walking the working tree, and `dist`, `coverage`, `node_modules`, `generated`, `__snapshots__` and `.d.ts` are not candidates to begin with. Taking build output and dependencies out of the lint's range is not this bundle's business.

### A setting that split

A state where a setting value several rules have to share is written in the options of one rule. Reported as `settingWrittenPerRule`. The setting names in range are `specFileSuffixes`, `blockSpelling`, `runnerModules` and `mockNamespace`.

Whether the values agree is not read. Only whether it is written in one place.

### The invariant

What is observed is specs that do not keep the discipline piling up in the repository while every rule holding the way tests are written is green.

The first layer is that these rules throw no exception about a file outside their range; they return zero reports. "It was not in range" and "there was no violation" have exactly the same shape in the output, and the information telling them apart does not exist on the output side. As long as a green lint is used as evidence of the discipline, that evidence does not stand unless a machine can say "zero specs are unreached".

The second layer is that the range drifts as a side effect of legitimate operations. A new directory, a new package, a renamed file, an ignore pattern added for speed. Each has a reason on its own, so it does not close by stopping operations. The resulting coverage has to be checked instead.

The third layer is that the drift breaks in the other direction too. Take files that are no tests into range and this bundle fires in the wrong place. A rule firing wrongly creates the motive to suppress, and once suppression starts the reports lose their meaning at all. Drift in either direction breaks the reports' trustworthiness.

A split setting value breaks the same way. Write the same value in two places and the moment one is rewritten the other loses sight of its subject and returns zero. Zero has the same shape as "no violation", so not even whoever rewrote it can tell. What is held is not that the values agree but a structure in which the agreement cannot break.

### Where the detection does not reach

- In a configuration where not one rule of this bundle is turned on, this rule does not run either. A rule cannot report that it was not called
- Reading the configuration sees only what appears in the syntax of the configuration file under check. What lies beyond an `extends`, and the contents of an entry assembled at run time, are not read
- A form taking `it` / `test` / `expect` out by destructuring is not read as a binding
- Test block declarations are settled by names and by following bindings. A binding that is the test runner's by type alone is not followed

### Configuration

None. Make the exceptions to the range expressible in configuration and those exceptions do the same work as what is missed. The spelling of spec file names, and every other setting value this bundle shares, is held in one place by the implementation.

## Fix

For what is missed, rename that file to a spec name, or move the test block into a spec file. Where what is being written is a specification-holding test, move it under a `specs` directory as a `.spec.ts`.

For what is swept in, change the name to another word, or change the file's name to one that is no spec.

For being turned off, put the lowered severity back and fix the reported violations. For an override that cut a range, delete that entry. For `ignorePatterns`, narrow the pattern so it covers build output alone.

For a split setting, place the value in one place and have every rule that reads it receive it from there. This bundle's defaults are held by the rule implementations, so using them as they come is the shortest repair.

There is no automatic fix. How to rename a file and where to place a shared value are judgments belonging to the configuration, and a machine cannot settle them uniquely.

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

- Taking the reported files out of range one by one to get back to zero. That only fixes what is missed in place, and nothing this invariant was holding comes back
- Setting this bundle's rules to `off` for specs and then reporting "no violations". The detection of being turned off drops that shape as it is
- Leaving a value that has to be shared written in two places and claiming "they agree at the moment, so there is no problem"
- Silencing it with a suppression directive

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
