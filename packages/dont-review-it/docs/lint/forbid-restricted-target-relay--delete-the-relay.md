---
description: "Disallow a local module passing a restricted target straight to its own public surface and disallow reading a restricted target through such a module, so a target held out of reach in one file stays out of reach behind a chain of local modules"
---

# forbid-restricted-target-relay--delete-the-relay

<!-- BEGIN GENERATED rule-header -->

Disallow a local module passing a restricted target straight to its own public surface and disallow reading a restricted target through such a module, so a target held out of reach in one file stays out of reach behind a chain of local modules

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`forbid-restricted-target-relay--delete-the-relay.ts`](../../src/lint/oxlint/rules/forbid-restricted-target-relay--delete-the-relay.ts)

<!-- END GENERATED rule-header -->

## Violation

Two independent violations against the restricted targets registered in the configuration (the `restricted` entries). With no entry registered, this rule reports nothing.

### Building a relay

The file being checked passing a restricted target straight through to its own published surface. Five shapes count.

- `export { readFile } from "retired-lib";` (a named re-export)
- `export * from "retired-lib";` (a wildcard re-export)
- `export * as retired from "retired-lib";` (a re-export of the whole namespace)
- `import { readFile } from "retired-lib";` and `export { readFile };` split across two statements
- `import retired from "retired-lib";` and `export default retired;` split across two statements

Splitting into two statements and renaming with `as` are the same violation, because the binding passed through is the same. The judgment runs on binding identity; the spelling it leaves under is not read.

**Building a relay is a violation even where the file sits inside an allowed position (`allowedPositions`).** An entry's allowed positions mean "you may use it here", not "you may pass it out from here". A published surface reaches regardless of where the file sits, so the freedom to use inside a boundary and the freedom to pass out of it are treated as separate. This judgment therefore uses every entry and applies no narrowing by allowed position.

### Reaching through a relay

The file being checked requesting, through a specifier that points inside the repository, something that is actually resolved and followed, and reaching a restricted target at the end. Relative paths, aliases written in `tsconfig`'s `paths`, prefixes registered under `internalAliases`, and the published entry of a workspace package are all followed.

Only files inside the repository are followed; the inside of an installed package is not. However many relays there are, the count does not affect the judgment, and cycles are cut with a visited set so the walk always stops.

**The entries used for this judgment are settled by the file being checked (the final position of use), not by the relay's position.** Read the same relay from a position the entry allows and nothing is reported.

### The unit of matching

A specifier and an entry's `module` are matched in three steps.

- Whole equality
- Subpath prefix. `retired-lib/deep/inner.js` matches the `retired-lib` entry. Only what starts with `name + "/"` matches, so a derived name such as `retired-lib-extra` is not swept in. To forbid a derived package, write it as its own entry
- Per named export. Writing `exports` on an entry leaves the module as a whole allowed and forbids reaching only the exports named. A wildcard re-export cannot narrow names, so it matches an entry carrying `exports` too

### The routes read

Static `import` declarations (including type-only imports), named re-exports, wildcard re-exports, dynamic `import(...)`, CommonJS `require(...)`, `import x = require(...)`, and `import("...")` in type position. **This list is kept without a gap.** One unread syntax left is one way into a relay left open.

Type-only imports are not excluded either. A place that only references a type still leaves the state depending on that module's type structure, and it grows into a value import eventually.

Specifiers are folded before matching. A string bound to a `const` in the same file, and a template literal whose every substitution folds, are settled into one string before being handed to resolution. An unfoldable specifier cannot be followed, but that is reported as a separate violation by [forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier](./forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier.md), so it is not silence.

### What the report carries

Building a relay carries the name of the restricted target being passed through and the spelling it leaves under. Reaching through a relay carries **every module the walk went through.** Printing only the consumer's specifier leaves the reader unable to follow why this is a violation. The chain of relays and the final target are laid out with `->`.

Both reports carry the substitute instruction written on the entry.

### The invariant

What is observed is code that keeps using a forbidden module, staying green through the checks.

The first layer is that a check reading specifiers takes "a specifier written inside one file" as its unit of judgment. Put one relay in between and the consumer's specifier becomes a local relative path matching no entry. The relay file itself imports the restricted target, but where that file sits in an allowed position or outside the checked set, nothing fires there either. **Two files are enough to build a state where not one reach is reported.**

The second layer is that relays come into being without any intent to evade. Making a thin wrapper is an everyday design act, and it does not look like a violation to whoever wrote it. With intent unavailable as a divider, the only way to close it is structurally.

The third layer is that every check reading specifiers shares the same hole. The hole is shared because the unit of judgment is shared, so strengthening any one of them leaves it. **Standing up one receiver whose unit of judgment is the repository's module graph is the only response that reaches all of them.**

### Configuration

```jsonc
[
  "error",
  {
    "restricted": [
      {
        "module": "retired-lib",
        "exports": ["readFile"],
        "allowedPositions": ["packages/*/src/adapters/**"],
        "substitute": "take the same value from the shared reader.",
      },
    ],
    "internalAliases": [{ "prefix": "~/", "directory": "src" }],
  },
]
```

`restricted` is a list of restricted targets. `module` and `substitute` are required; `exports` and `allowedPositions` may be omitted.

- `module` is the name of the module to forbid. Do not write a subpath — a deep path matches the same entry by prefix
- Writing `exports` forbids reaching only the exports named. Omitting it puts the whole module in scope
- `allowedPositions` is a list of globs exempting **reading** from files placed there. It does **not** exempt passing through
- `substitute` is the replacement instruction placed in the report. It sits where whoever added the prohibition cannot forget to write the reason and the destination

`internalAliases` registers a prefix that points inside the repository in a form that is neither a relative path nor `tsconfig`'s `paths`. A specifier matching `prefix` is resolved with `directory` taken as a position from the workspace root, and then followed.

This rule carries no default restricted targets. **Share one array of restrictions with the other checks that read specifiers.** Split the array in two and the same name starts holding on one route and not on another.

### What this check does not take on

- **A boundary's own published surface.** A boundary publishes its own vocabulary rather than passing the raw API through, so the binding is transformed. The judgment is "does the restricted binding leave as it is", so what leaves through a function or a type the boundary defined does not count as a reach
- **Whether a wrapper is too thin to mean anything.** Passing straight through is caught by binding identity, so what is left here is only "transformed but barely meaningful". No check holds that judgment; a person reads it and decides
- **Re-exports happening inside an installed package.** The walk covers files inside the repository only
- **A target being reached where it is not forbidden at that position of use**
- **What lies past an unfoldable specifier.** There is no way in to start the walk. The specifier itself is reported as a violation by `forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier`
- **Naming the restricted target directly inside one file.** Where the consumer's specifier matches an entry, that belongs to the check that matches specifiers. This rule reads only what lies past a relay

## Fix

Delete the relay and rewrite the consumer to the entry's substitute.

Where a wrapping layer is needed, rebuild it as a boundary that publishes its own vocabulary instead of passing through. Rather than `export { readFile } from "retired-lib";`, call the `retired-lib` function inside and publish under the name and the parameters this module decided. With the binding transformed, this rule does not count it as a reach.

Where that target is genuinely needed at that position, add the position to the entry's `allowedPositions`. Even inside an allowed position, the shape that passes it out keeps being reported.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a named re-export puts the target on this module's surface
export { readFile } from "retired-lib";
```

```ts
// reading a module that forwards the target reaches the target
import { readFile } from "./star-forward.ts";
```

Code this rule accepts.

```ts
// a boundary that publishes its own vocabulary keeps the target off its surface
import { readFile } from "retired-lib";
export const read = (path: string) => readFile(path);
```

```ts
// reading a boundary that transforms the binding reaches nothing
import { read } from "./boundary.ts";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Making the relay two steps or more. The count does not affect the judgment
- Exporting under a changed name inside the relay. Binding identity is what is followed, so it matches
- Placing the relay in a range excluded from the check as a demo or an illustration. An exclusion does not carry into the judgment at the position of use
- Carving the relay out as a separate package and declaring it as a dependency. **That dependency name is not on the restriction list, so it stays outside the view of the check that reads the dependency field, but nothing changes about a published surface passing a restricted target through.** The correct response on finding this is to add that dependency name to the restriction list
- Silencing it with a suppression comment. Exceptions live in the configuration, not on a line of source

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `restrictedTargetForward` | A local module must not pass a restricted target straight to its own public surface. This module exposes \`{{target}}\` as \`{{exposed}}\`. Delete this forward, or rebuild this module as a boundary that publishes its own vocabulary. {{substitute}} Register an exception as an entry in the lint configuration. |
| `relayedTargetForward` | A local module must not pass a restricted target straight to its own public surface. This module exposes \`{{target}}\` as \`{{exposed}}\` through \`{{relays}}\`. Delete this forward, or rebuild this module as a boundary that publishes its own vocabulary. {{substitute}} Register an exception as an entry in the lint configuration. |
| `relayedTargetReach` | A module must not read a restricted target through a local module that forwards it. \`{{specifier}}\` reaches \`{{target}}\` through \`{{relays}}\`. Delete the forwarding module, or rebuild it as a boundary that publishes its own vocabulary. {{substitute}} Register an exception as an entry in the lint configuration. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
