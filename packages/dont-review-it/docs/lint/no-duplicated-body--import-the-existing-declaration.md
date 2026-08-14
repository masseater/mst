---
description: "Disallow a declaration whose body is spelled exactly as another declaration elsewhere in the repository, so one behaviour keeps one owner instead of drifting between copies"
---

# no-duplicated-body--import-the-existing-declaration

<!-- BEGIN GENERATED rule-header -->

Disallow a declaration whose body is spelled exactly as another declaration elsewhere in the repository, so one behaviour keeps one owner instead of drifting between copies

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-duplicated-body--import-the-existing-declaration.ts`](../../src/lint/oxlint/rules/no-duplicated-body--import-the-existing-declaration.ts)

<!-- END GENERATED rule-header -->

## Violation

A declaration in a production TypeScript source whose body is spelled word for word the same as another declaration in the repository.

Only top-level declarations are read, in four shapes.

- A binding (`const` / `let` / `var`), with its type annotation and initializer as the body
- A function declaration, with its type parameters, parameters, return type, body, and whether it is `async` or a generator as the body
- A type alias, with its type parameters and right-hand side as the body
- An interface, with its type parameters, `extends` clause and members as the body

**The declaration's own name is not part of the body**, so that a copy differing only in name is caught. A pair matching in name as well is taken separately by [no-twin-declaration--merge-into-one-owner](./no-twin-declaration--merge-into-one-owner.md).

An anonymous function expression written straight into a call position is out of scope. A declaration inside another declaration is out of scope. What does not stand at the top level is part of the procedure it sits in rather than a unit anything in the repository can import.

### How the match is settled

The body is turned into an AST, and the structure with position information (`start` / `end` / `range` / `loc`) dropped is stringified and compared. What is dropped and what is kept:

- Comments are dropped. Treating the same work as different because a different note sits on it would make this detection useless
- Whitespace and newlines are dropped. A difference in formatting is not a difference in body
- Strings and template literals keep their spelling. Two of the same shape differing only in the message are different
- Identifiers stay as written. **A bound name and a free name arriving from an import or a global are not distinguished**

Comparing identifiers as written is the weakest matching condition in this detection. There is room to strengthen it by normalizing bound names to absorb differences in parameter names, but in the repository as it stands every known duplicate is caught without that. Start from the weak side and widen when a miss is actually found.

There is also a positive reason not to collapse free names. `attempt(() => statSync(path))[1]` and `attempt(() => readFileSync(path, "utf8"))[1]` have the same structure and differ only in the name of what they call. Collapse there and every stock form that aligns how failures are handled becomes one fingerprint, and the reports lose their meaning.

### Bodies that are too short

A body of fewer than eight AST nodes is not reported. Short bodies match by chance. `= 1` and `= []` matching somewhere in the repository holds no behaviour worth sharing.

The rule without that lower bound is [no-twin-declaration--merge-into-one-owner](./no-twin-declaration--merge-into-one-owner.md). With the name matching too it is not a chance match, so that one does not read the size of the body. Where the name and the body both match and the body is eight nodes or more, both rules report the same declaration. Both reports are right at once, and settling on one owner clears both.

### The range of the index

The index is built from the repository root. The root is settled by walking up from the lint's working directory. Run the lint from a package directory and it sees the same index as running it from the whole repository.

Test files, and everything under a test directory, are not in the index. The judgment is the same one [no-strict-canonical-literal-use--use-canonical-import](./no-strict-canonical-literal-use--use-canonical-import.md) uses. There are places where writing the same shape of setup over and over is right in a test, and binding that is not this rule's job.

### The invariant

With the same body in two places, changing one drops nothing. The tests pass and the type check passes. That it broke becomes visible when the two spellings, having diverged, reach separate callers — and nothing there links back to the two original places.

This is not carelessness on the writer's part; it comes out as a consequence of how writing works. Write the work you need without reading the whole repository and something identical to an existing implementation is born. Neither the side that was born nor the side that gave birth has any occasion to learn the other exists. So the machine links them.

There is no automatic fix because a matching body does not prove the same concept. The same spelling can belong to separate responsibilities, and there the right move is to keep both under different names rather than delete one. Which is the owner is settled by a person who reads the responsibilities around them.

### Configuration

None. No per-rule exclusion, no per-package exclusion, no per-declaration exclusion tag. Leave one mouth for suppression open and "excluded because it was tiresome" piles up.

### What is not detected

- Similarity short of an exact match. The same work written in different spellings is not caught. Put a threshold on similarity and it could be picked up, but a report settled by a threshold does not fit an enforcement level of "an error by default". Only what can be settled deterministically is handled here
- Writing it yourself when a dependency package holds the same function. There is no import, so no trace is left in the syntax
- A declaration of a value used only once. That could be settled deterministically, but it does not hold as a norm. Most single-reference top-level declarations are the good practice of splitting a long procedure into named steps. For types this judgment was overturned by [EDR 0019](../../../../docs/engineering-decision-logs/0019-name-a-type-only-where-two-places-agree.md), and [no-single-use-local-type--inline-at-the-use-site](./no-single-use-local-type--inline-at-the-use-site.md) takes it
- Declarations matching in name and body whose body is under eight nodes. [no-twin-declaration--merge-into-one-owner](./no-twin-declaration--merge-into-one-owner.md) takes those

## Fix

Read every position listed in the report, then settle where that behaviour should be owned.

Once the owner is settled, export from there and import everywhere else. When choosing the owner, do not choose by the order they appear in the report, do not choose the one written first, and do not choose the one with the better name. Choose by whose responsibility that behaviour is.

Where the duplication spans packages, settle which package owns it. Where that cannot be settled, put it somewhere both can depend on. Do not reverse a dependency direction to force it onto one side.

Where you judge the bodies the same but the responsibilities different, actually make one of them a different implementation. Changing only the name does not clear the report.

Where a dependency package's public API already holds the same behaviour, use that and delete both.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a declaration whose body is spelled the same elsewhere is reported
const twice = (value: number): number => value * 2;
```

<!-- END GENERATED examples -->

The subject of this rule is the bodies declared across the repository rather than the source in front of you alone, so the code above is the file the report stands on, and what settles the judgment is whether the same body is spelled somewhere else.

### Forbidden bypasses (do not do this)

- Adding a meaningless statement or binding to the body to break the match. The duplication stays and only the report clears
- Routing through one extra parameter to shift the spelling. As above
- Moving one side into a test file. That the index does not read tests is not a mouth for hiding duplication

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `duplicatedBody` | A declaration must not repeat a body that already exists elsewhere in this repository. The same body is declared at {{sites}}. Decide which module owns the behaviour, export it from there, and import it everywhere else. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
