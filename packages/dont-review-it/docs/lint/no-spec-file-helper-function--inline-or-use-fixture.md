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
- Shipped in the preset: yes
- Source: [`no-spec-file-helper-function--inline-or-use-fixture.ts`](../../src/lint/oxlint/rules/no-spec-file-helper-function--inline-or-use-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

A function binding placed at module scope or in the body of a grouping block (`describe`) inside a spec file. A fixture-builder binding placed at module scope. And a fixture handing over a function expression written on the spot as its provided value.

The files in scope are settled by the file name suffix. The default is `.test.ts` and `.test.tsx`, replaceable through `specFileSuffixes`.

### How scope is settled

Whether a declaration is in a target scope is settled by **the innermost function enclosing it**. Enclosure is judged by AST containment, so writing it inside an `if` or a bare block does not change the scope unless a function comes between.

| The innermost enclosing function | Judgment |
| --- | --- |
| None (module scope) | In scope |
| A grouping block's callback | In scope |
| An `it` callback, a fixture body, or a function inside those | Out of scope |

Fixture builders alone are measured one step differently. A function binding is in scope the moment it stands in a grouping block's body, while a grouping block's body is exactly where a fixture builder belongs, so only the form with no enclosing function at all (module scope) is in scope.

| The innermost enclosing function | Fixture builder judgment |
| --- | --- |
| None (module scope) | In scope |
| A grouping block's callback | Out of scope |
| An `it` callback, or inside one | Out of scope |

Whether something is a grouping block is settled not by the spelling of the identifier at the call's root but by what that identifier is bound to. A name the runner injected globally, one brought in by an explicit import, one bound to an alias with `import ... as`, one rebound locally, and one arriving through a re-export are followed through their bindings and treated as the same thing. A modified call such as `describe.each(rows)(...)` reaches the same root, so its callback is a grouping block's body.

### The six shapes reported

| messageId | What is read |
| --- | --- |
| `scopedHelperDeclaration` | A function declaration in a target scope, including a nameless default-export function declaration |
| `scopedHelperBinding` | A binding in a target scope whose initializer is an arrow function or a function expression |
| `disguisedHelperBinding` | A binding in a target scope whose initializer is a call expression returning a syntactic function |
| `containedHelperBinding` | A binding in a target scope whose initializer is itself an object or array literal with a function expression inside |
| `moduleScopeFixtureBinding` | A binding at module scope whose initializer is an `extend` call declaring fixtures |
| `handedHelperFixture` | A fixture whose provided value is a function expression written on the spot |

`moduleScopeFixtureBinding` reports once per binding. A chain of `test.extend(...).extend(...)` and a single `extend` carrying several fixtures both bind one name and are gathered into one report. A `base.extend(...)` derived from another binding makes two, because the base and the derivation are each a binding. That shape and `handedHelperFixture` are independent, so a fixture standing at module scope whose provided value is also a function receives both at once.

`disguisedHelperBinding` reads inside a call by two routes.

1. **An immediate invocation.** A form calling a function expression written on the spot. Besides a concise body that is itself a function, every `return` in a block body is read. `return`s inside a conditional, a `try` / `catch` / `finally`, a loop and each `switch` case are read alike. It is reported where what returns is a function, and where a function expression appears inside a returned literal
2. **A factory in the same file.** A form whose callee is an identifier resolving to a function declaration in the same file, or a `const` whose initializer is a function. Where any `return` of that function is a syntactic function, it is reported

`containedHelperBinding` reads recursively inside nested literals. Method shorthand and accessors count as functions the literal holds too.

The provided value `handedHelperFixture` reads is the expression reaching the `return` of the builder form `test.extend("name", factory)`, the first argument reaching `use` in the object form `test.extend({ name: (context, use) => use(subject) })`, and the value itself where a value rather than a function was handed over. The fixture's name is not used in the judgment. `expect.extend(...)` shares the spelling but declares no fixture and falls out structurally.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A call whose callee does not resolve to a function in the same file | The callee's body cannot be read. The fixture builder `test.extend(...)` and its derivations are not read into, and where they are placed is read separately by `moduleScopeFixtureBinding` |
| A fixture builder in a grouping block's body | Exactly the placement the reading asks for |
| A fixture builder declared outside a spec file | A base several specs share, and this rule reads spec files only |
| A factory whose callee lives in another file | That file is itself a setup module in the sense of [no-dry-test-setup--inline-owned-setup](./no-dry-test-setup--inline-owned-setup.md) |
| An immediate invocation returning something other than a function | Assembling a configuration object or a constant. Only where a function expression appears in the returned literal is it reported as a container |
| A binding through a `new` expression | Not a function binding |
| Class declarations and type aliases | Not function bindings |
| A module-scope `const` holding no function expression | A test data constant |
| A declaration with no initializer | There is no initializer to read |
| A function declared inside an `it`, a fixture body, or inside those | Closed inside one test or one fixture |
| A fixture providing an existing binding or an imported identifier | That is handing over the subject under test where it is a function, not a hiding place for a helper |
| A literal written as a call's argument | Not a binding's initializer. A literal handed to a fixture is read by `handedHelperFixture` |

### The invariant

One spec file is a contract from which what is verified and how can be learnt by reading that file alone — this rule holds the side of **extraction happening inside the same file**. Extraction across files is closed by `no-dry-test-setup--inline-owned-setup`.

The first layer is the contract's readability. A wrapper helper pulls the setup and the subject under test out of the `it`. Even with the file still one, all that runs when reading the `it` is a helper call, and what that call assembles and executes cannot be known without going back outside the block. The test stops describing a contract and becomes a call to "something assembled somewhere".

The second layer is parallel isolation. Tests run in parallel by default. A module-scope helper easily becomes a closure shared by several tests, and the moment mutable state rides on it, it is a way in for leakage between tests. Failures appear in a form that moves position from run to run, and reading the failing test itself does not reach the cause.

The third layer is that the destination of the fix is closed by the rule itself. The fix this rule recommends is moving the helper into a base fixture, so if the helper is handed over there as a function unchanged, the failure mode has not moved at all. Another group reading fixture contents holds a name gate on fixture names; this one reads no name. That is why enabling both converges the recommended shape on one thing: hand over the result.

Taking fixture builders out of module scope is a face of the same invariant. A fixture is the one place a helper may be moved to, so it cannot be closed off. What is closed is the distance. A fixture standing at the head of the file reaches every grouping block below it, and the distance a reader travels from a name in an `it`'s parameter back to the declaration grows as the file grows. Which grouping block the subject is for loses every handle but the name. Place it in a grouping block's body and the behaviour's name and the assembly of its subject stand together in one nesting. Where several grouping blocks need the same base, the grouping block enclosing them remains as the place, so no shape becomes inexpressible.

In this bundle single-file readability outranks DRY. Setup duplicated between independent specs is an accepted price rather than debt to reduce.

### Configuration

| Name | Default | Meaning |
| --- | --- | --- |
| `specFileSuffixes` | `[".test.ts", ".test.tsx"]` | The suffixes taken as spec files |

Grouping block spellings are not taken from the configuration. The judgment runs on binding resolution, so adding spellings changes nothing about what is detected. There is no setting for allowing individual helpers either: make an exception expressible in configuration and a route opens where whoever received a report adds an exception instead of fixing it.

How much procedure may go inside a fixture is settled by another group, so read the fix below together with those constraints.

## Fix

Where only one test uses it, expand it into that `it`. Where several grouping blocks need the same behaviour, make a common base fixture **run** that behaviour and hand over the assembled subject, then derive each grouping block's fixture from it. What the base fixture hands over is the subject, not the procedure that assembles it.

Place a fixture declaration in the body of the grouping block holding the `it`s that read it. Place the base fixture it derives from in the body of the grouping block enclosing the deriving ones.

```ts
describe("specStemOf", () => {
  describe("a name carrying a spec suffix", () => {
    const it = test.extend("stem", () => specStemOf("report.test.ts", DEFAULT_SPEC_FILE_SUFFIXES));

    it("drops the longest matching suffix from the base name", ({ stem }) => {
      expect(stem).toBe("report");
    });
  });
});
```

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

- **Wrapping in an immediately invoked function to look like a call expression.** What returns is read
- **Returning the function from inside a conditional or a `try` to avoid a direct `return`.** Every `return` in the block body is read
- **Defining a factory first and making it look like that call's result.** Where the callee is in the same file, what it returns is followed
- **Repacking into an object or an array to look like a test data constant.** Where the initializer is a literal, its inside is read recursively
- **Moving the helper to another file.** `no-dry-test-setup--inline-owned-setup` receives it
- **Moving the helper into a base fixture and handing it over as a function.** Even where the destination is a fixture, handing over a procedure is reported
- **Importing the grouping block explicitly and binding it to an alias to leave the scope judgment.** The judgment runs on binding resolution rather than spelling
- **Keeping the helper and changing only its name.** The judgment runs on the scope it stands in and the shape of the binding, not on names
- **Placing the fixture at the head of the file and reusing it across every grouping block.** A module-scope fixture-builder binding is reported
- **Chaining `extend` into one binding to show fewer declarations.** The judgment runs on where the binding stands, not on the count
- **Wrapping the fixture in parentheses or a type assertion to change the binding's shape.** Wrappers are peeled before reading whether it is an `extend` call
- **Moving the factory to another file to make it look like a call's result.** It disappears from this reading, and what is bound is still a function
- **A suppression directive**

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
