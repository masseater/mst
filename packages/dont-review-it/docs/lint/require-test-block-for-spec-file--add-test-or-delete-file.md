---
description: "Require a file named as a spec to declare at least one test block that runs, so naming a file a spec costs a check that actually executes rather than buying the standing of a spec for free"
---

# require-test-block-for-spec-file--add-test-or-delete-file

<!-- BEGIN GENERATED rule-header -->

Require a file named as a spec to declare at least one test block that runs, so naming a file a spec costs a check that actually executes rather than buying the standing of a spec for free

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`require-test-block-for-spec-file--add-test-or-delete-file.ts`](../../src/lint/oxlint/rules/require-test-block-for-spec-file--add-test-or-delete-file.ts)

<!-- END GENERATED rule-header -->

## Violation

A file carrying the spelling of a spec while declaring not one test block that runs.

The subjects are files whose names answer to `specFileSuffixes`. The report stands on the whole file (the `Program` node), because there is no line inside the file to point at. Which message comes out depends on how "not one" was read.

- `noTestBlock`: not one test block and not one grouping block
- `onlyGroupingBlocks`: grouping blocks are there, and nowhere inside them is a test block
- `heldBackTestBlocks`: test blocks are there, and not one of them runs

Whether something is a test block follows the shared root reading (`lib/spec-syntax/test-block-declarations.ts`). It is read by resolving bindings rather than by spelling, so an `it` / `test` injected globally, a binding renamed with `import { it as check } from "vite-plus/test"`, and a binding derived with `const check = test.extend({ ... })` are all the same test block. The name being written as a string is not a condition: what is read here is whether it runs, and the shape of the name belongs to another rule.

Whether it runs is read like this.

- A `skip` or a `todo` anywhere in the chain of modifiers means it does not run. `skipIf` / `runIf` branch at run time, so a running path is taken to remain in the syntax
- Where a grouping block carries a `skip` or a `todo`, the blocks written inside it do not run either
- A declaration handed no callback (`it("carries the id")`) does not run. The runner reports it as a todo
- A table-driven declaration (`each` / `for`) runs where the table is an array literal written in place carrying one or more elements. `it.each([])(...)` runs nothing, so it lands on the side that does not run

**The report comes out only where "not one test runs" can be said outright.** Where one shape it cannot read through is mixed in, it stays quiet about that file. Being unable to settle that the count is zero, and the count not being zero, are different things.

### A call reaching another module

The specs of the lint rules in this repository write no test block themselves and have `testLintRule` declare them. Not one `it` stands in the file, and running it runs tests. So that this shape is not reported, one call reaching another module from a position that runs at collection time is enough for that file to be treated as one it cannot read through.

The judgment is narrowed by three conditions.

- The callee's root is a name bound by an import. A member call through a namespace import, and a form handing an imported name on to a local binding, are followed to the binding and treated the same
- Bindings of test blocks and grouping blocks are excluded. Without that, importing `describe` would leave every file unreadable
- The inside of a call rooted at a test block binding is excluded. A block's body and a fixture's initialiser run at test time rather than at collection time, so reaching another module from there adds no test. A file with everything skipped still gets its report even where the body calls the code under test

This reading works only in the direction of clearing reports. A file judged unreadable goes quiet, and no new report ever comes out because of this judgment.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A table settled at run time (`it.each(rows)(...)`) | The element count is settled only at run time. Zero cannot be settled |
| A table written as a tagged template | The rows are not read. Zero cannot be settled either |
| A declaration whose arguments are spread (`it("carries the id", ...declaration)`) | The arguments handed over cannot be read |
| A declaration handed a name in the body position (`it("carries the id", carriesTheId)`) | The function that name stands for is not read. Leaning it to the side that does not run would misreport |
| A modifier settled at run time (`it[chosen](...)`) | The root cannot be resolved, so it is not counted as a test block. With no other declaration it reads as "there is no block". That shape itself is forbidden by [no-computed-test-api-member--use-static-member](./no-computed-test-api-member--use-static-member.md) |
| A block written inside a function nobody calls | A declaration standing in the syntax counts. Reachability is not read |
| A file that does not answer to the spec spelling | Outside `specFileSuffixes` nothing is read |

The judgment runs **per visited file**. Take the file out of the analysis, therefore, and this rule does not fire. Deriving the target set from a walk of the repository tree, independent of the target naming, cannot be done by the rule alone, because oxlint's JS plugins confine a report's position to a node inside the file under check. The judgment itself is a pure reading of the visited file's syntax, so it can be called as it stands once a form of execution entered through a walk is added.

This is not a rule for making existing specs change; it is a rule for stopping the empty spec about to be placed.

### The invariant

What is held is that carrying the name of a spec comes at the price of holding a test that runs.

The first layer is that the owner of test data has substance. [require-spec-file-for-assets--create-matching-spec](./require-spec-file-for-assets--create-matching-spec.md) confirms whether an owner exists by matching file names alone. Place an empty spec with the matching stem and that check passes. Once it does, the meaning of ownership — that somebody actually confirms something with that data — drops out, and a state of names merely agreeing gets called ownership. Keeping the existence check and the contents check as two rules while putting both on the machinery closes the bypass of matching the name alone.

The second layer is that carrying the name of a spec is a qualification for a classification. The other rules of this bundle classify a spec file as "something that may own test data" and "something that may sit in a spec directory". Let a file holding not one test carry the name of a spec and an owner without substance is born, and the restriction on what kinds may sit in the directory is met by a name too. Put a price on the name and this classification stops being purchasable with names.

The third layer is that a verification that does not run cannot be told from one that passed. A file left holding permanently stopped blocks lines names up in the report while confirming nothing. It only thins the meaning of green, and holds no power to detect a regression.

### Configuration

- `specFileSuffixes` (an array of strings, optional): the suffixes treated as a spec. The default is `[".test.ts", ".test.tsx"]`, and naming it **replaces** it (it does not add). Handed an empty array, the default comes back. It carries the same name and the same meaning as in the other rules of this bundle, on the premise that one spelling is levelled across the repository

```jsonc
["error", { "specFileSuffixes": [".test.ts"] }]
```

There is no exemption list. "This one file may hold no test" means one spec that does not run may exist, which contradicts the discipline itself. How many running tests are demanded is not an option either: a setting able to take the lower bound to zero is the same as being able to turn this rule off by editing a setting.

## Fix

Write a block that actually confirms something about what that file names. Where what should be confirmed cannot be settled on the spot, delete the file.

Deleting it, delete the test data file of the same stem with it. Test data whose owner is gone is reported next as an orphan by the rule on the test data side. Delete one alone and the report only moves to another file.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a file with nothing in it names a spec that checks nothing
// in report.test.ts

```

```ts
// blocks marked as skipped run nothing
// in report.test.ts
it.skip("carries the id", () => {
  expect(summarise("a").id).toBe("a");
});
```

Code this rule accepts.

```ts
// a block that runs carries the file
// in report.test.ts
it("carries the id", ({ report }) => {
  expect(report.id).toBe("a");
});
```

```ts
// one block that runs is enough, however many are held back beside it
// in report.test.ts
it.skip("carries the id", () => {});
it.todo("carries the total");
it("carries the name", ({ report }) => {
  expect(report.name).toBe("a");
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- **Placing an empty spec with a matching name to look like the owner of test data.** The existence check passes, and this rule reads the contents
- **Leaving the contents entirely as `skip` / `todo`.** Stopped blocks are not counted as running tests. Stopping them together by marking the group is handled the same way
- **Placing only the divisions of a `describe`.** A grouping block confirms nothing by itself
- **Moving the test block to a binding of another name to slip the judgment.** It is read by resolving bindings, not by spelling
- **Stepping off the spec spelling to leave the target set.** The moment you step off, the test data has no owner, so the rule on the test data side reports it
- **Rewriting the table into a form settled at run time to lose the certainty.** The report clears, but that is a range the detection cannot reach and no permission to place an empty table
- **Spreading the arguments so they cannot be read.** A range the detection cannot reach, likewise
- **Calling one imported name inside an empty spec.** With a call reaching another module at collection time, this rule goes quiet. A range the detection cannot reach, and no permission
- **A suppression directive**

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `noTestBlock` | A file named as a spec must not stand without a test block that runs. This one declares no block at all. Write the block that checks what the subject is expected to do, or delete this file together with the test data named after its stem. |
| `onlyGroupingBlocks` | A file named as a spec must not stand on grouping blocks alone. The groups here hold no test block, and a group checks nothing of its own. Write the block each group promises, or delete this file together with the test data named after its stem. |
| `heldBackTestBlocks` | A file named as a spec must not stand on test blocks that are all held back. Every block here is marked as skipped or as todo, left standing without a body, or driven by a table written out empty. Write a block that runs, or delete this file together with the test data named after its stem. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
