---
description: "Disallow a helper function standing at module scope or in the body of a grouping block of a spec file, a fixture builder standing at module scope, and a fixture handing back a function written in place, so the block that names a behaviour also spells out the work that behaviour runs"
---

# no-spec-file-helper-function--inline-or-use-fixture

<!-- BEGIN GENERATED rule-header -->

Disallow a helper function standing at module scope or in the body of a grouping block of a spec file, a fixture builder standing at module scope, and a fixture handing back a function written in place, so the block that names a behaviour also spells out the work that behaviour runs

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `testing`
- Source: [`no-spec-file-helper-function--inline-or-use-fixture.ts`](../../src/lint/oxlint/rules/testing/no-spec-file-helper-function--inline-or-use-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

Work parked outside the block that names the behaviour. Six reports, all inside spec files.

- A function declaration standing at module scope or in the body of a grouping block
- A binding initialised with a function in one of those scopes
- A binding whose value comes from a call that hands back a function: an immediately invoked one, or a factory declared in this file
- A binding carrying functions inside an object or array literal, however deeply nested
- A fixture builder standing at module scope
- A fixture handing back a function written in place

## Fix

Inline the body into the test block that uses it, or have a base fixture run that behaviour and hand back the subject it built.

Move a fixture builder into the body of the grouping block whose test blocks read it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a function declared at module scope is reached by every test in the file
// in report.test.ts
function build() {
  return 1;
}
```

```ts
// a fixture builder at module scope is reached by every test in the file
// in report.test.ts
const it = test.extend("report", () => summarise(rows));
```

Code this rule accepts.

```ts
// a function declared in a test block stays inside the one test that runs it
// in report.test.ts
it("names a behaviour", () => {
  function build() {
    return 1;
  }
  expect(build()).toBe(1);
});
```

```ts
// a fixture builder declared in the body of a grouping block stands beside the tests that read it
// in report.test.ts
describe("a report", () => {
  const it = test.extend("report", () => summarise(rows));
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming the helper, or moving it into another grouping block. Both leave it in the same scope
- Nesting the functions deeper inside a literal, or handing them back from a factory. Both are followed

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `scopedHelperDeclaration` | A function declaration must not stand at module scope or in the body of a grouping block. Inline the body of \`{{name}}\` into the test block that uses it, or have a base fixture run that behaviour and hand back the subject it built. Renaming the declaration and moving it into another grouping block keep it in the same scope. |
| `scopedHelperBinding` | A binding initialised with a function must not stand at module scope or in the body of a grouping block. Inline the body of \`{{name}}\` into the test block that uses it, or have a base fixture run that behaviour and hand back the subject it built. Renaming the binding and moving it into another grouping block keep it in the same scope. |
| `disguisedHelperBinding` | A binding must not take its value from a call that hands back a function. Inline the body of \`{{name}}\` into the test block that uses it, or have a base fixture run that behaviour and hand back the subject it built. An immediately invoked call, a return written inside a branch, a loop, a \`switch\` or a \`try\`, and a factory declared in this file are read the same way. |
| `containedHelperBinding` | A binding must not carry functions inside an object or an array literal at module scope or in the body of a grouping block. Inline each function \`{{name}}\` carries into the test block that uses it, or have a base fixture run those behaviours and hand back the subjects they built. Nesting the literal deeper keeps the functions in the same scope. |
| `moduleScopeFixtureBinding` | A fixture builder must not stand at module scope. Move \`{{name}}\` into the body of the grouping block whose test blocks read it, so the block that names a behaviour also stands beside the subject it reads. A builder derived from another builder and a builder carrying several fixtures are read the same way. |
| `handedHelperFixture` | A fixture must not hand back a function written in place. Rewrite \`{{name}}\` to run that behaviour itself and hand back the subject it built, and leave the assertions against that subject standing in the test block. A fixture named anything at all is read the same way. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
