---
description: "Disallow text written out in the source at the destination argument of a call that opens a connection, so where a deployment talks to is decided by its configuration rather than by the file that performs the request"
---

# no-hardcoded-endpoint--read-from-configuration

<!-- BEGIN GENERATED rule-header -->

Disallow text written out in the source at the destination argument of a call that opens a connection, so where a deployment talks to is decided by its configuration rather than by the file that performs the request

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-hardcoded-endpoint--read-from-configuration.ts`](../../src/lint/oxlint/rules/no-hardcoded-endpoint--read-from-configuration.ts)

<!-- END GENERATED rule-header -->

## Violation

A string written out in the source appearing in the **destination argument** of a call that opens a connection.

### The judgment runs on where it is handed, not on how it looks

The judgment never reads the shape of the literal. It reads only **where that literal is handed**. Where a string written out in the source stands in the destination position, the report stands, and whether that string looks like a URL or like an identifier is not read at all.

A shape-based judgment does not work here. Most URL-shaped literals in a repository are external links in scaffold-generated pages and expected values in tests that check how a document URL is assembled — and a scaffold's output must not be replaced with a design of one's own, so a shape-based version collides with the norms the moment it is added. Identifier-shaped literals are overwhelmingly rule names, message ids and AST node kinds. A shape-based rule hits none of what should be fixed while reporting all of what must not be. Judge on where it is handed and only values that actually leave are reported, and no list of targets has to be held as an option on the configuration side.

[no-hardcoded-provider-id--read-from-configuration](./no-hardcoded-provider-id--read-from-configuration.md) is written on the same policy. The two differ only in which position they read.

### What counts as a connection destination

The **first argument** of these calls is the destination. All are platform-provided and exist without adding a dependency.

| Call | Destination |
| --- | --- |
| `fetch(...)` | First argument |
| `<receiver>.fetch(...)` | First argument |
| `navigator.sendBeacon(...)` | First argument |
| `new Request(...)` | First argument |
| `new WebSocket(...)` | First argument |
| `new EventSource(...)` | First argument |

`<receiver>.fetch(...)` reads the property name alone. `globalThis.fetch(...)` and `window.fetch(...)` are treated as the same call.

Node's `http.request` / `https.request` mostly take the destination in an options object, which is a different way in. HTTP client libraries are not in this repository. Once either is used, adding that shape to this list is the paired work.

### What counts as a string written out

The destination expression counts as written out where it contains even one of these.

- A string literal
- A non-empty static part of a template literal
- Either side of a `+` concatenation holding one of the above

So ``fetch(`${config.origin}/api/catalog`)`` is reported: the origin comes from configuration, but the path is baked into this file. ``fetch(`${origin}${path}`)`` is not reported: the static parts are empty and the destination is settled by values alone.

Parentheses are peeled. `fetch(('https://example.test'))` is treated as `fetch('https://example.test')`.

### Link notation in markup

Out of scope. The exclusion comes out of the structure of the judgment rather than from a list of special cases.

```ts
document.body.innerHTML = `<a href="https://vite.dev/" target="_blank">Vite</a>`;
```

That `https://vite.dev/` is not an argument of a call that opens a connection. It is text inside a template literal, and whether a browser follows it is settled by the user's action. It never enters the way in, so it is never reported. For the same reason an assignment to an attribute (`anchor.href = '...'`), a URL written as a test's expected value, and a constant handed nowhere are all out of scope.

### The boundary of the walk

There is no exemption by file kind. Test code is treated the same. There is no reason a test may connect to a real destination, and where it does, that destination should come from the test's configuration.

Taking the destination into a variable before handing it over (`const url = 'https://...'; fetch(url);`) is not reported. The judgment reads only the expression standing in the destination position and does not follow where that expression came from. That is named under forbidden bypasses.

### The invariant

Where to connect is settled by the configuration that runs the code, not by the code that connects.

Of everything in a request, the destination is what necessarily differs per environment. The same source has to reach a local stub in tests, a staging host in review and the real host in production. A string baked into a call can only ever be one of those. Becoming either of the other two means rewriting the source and producing a different build.

It breaks in two layers.

The first is that an artefact can hold only one environment. A build works correctly only where the person who made it ran it. It becomes either "rewrite on each deploy" or "a separate build per environment", and both create the state where what is running and what was verified are different things.

The second is that no check can find a wrong destination. A destination is an untyped string, and where it connects is not known until it connects. The type check passes and the tests pass. The tests pass because either they connect to the real destination or the destination was rewritten just for them, and in the latter case the tests are checking code that differs from the product. Here too arises what this repository dislikes most: the lint is green and nothing was checked.

The string written out is not the problem in itself. It is that string **standing in a connection destination** that builds those two layers.

### Configuration

None. Only whether the rule is on or off is settled by the configuration. The list of calls that open a connection is held by the rule. It is not something that varies per deployment target, and where it changes, the rule itself is repaired.

## Fix

Read the destination from configuration and hand it over. Two ways to take it.

**Take it from the environment that started the process.** Values that differ per deployment go where deployments differ.

```ts
const catalogEndpoint = process.env.CATALOG_ENDPOINT;
const response = await fetch(catalogEndpoint);
```

**Take it as a function parameter.** Let the caller settle where to connect. A test hands over the stub's destination, and the product code hands over the value it read from configuration.

```ts
const readCatalog = async (endpoint: string): Promise<Catalog> => {
  const response = await fetch(endpoint);
  return parseCatalog(await response.text());
};
```

Taking only part of the destination from configuration (`` `${origin}/api/catalog` ``) is not a solution. The path is part of the destination too, and it changes when the connection target changes. Have the destination arrive from configuration as one value.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a written out destination passed to fetch is reported
fetch('https://example.test/catalog');
```

```ts
// a written out path appended to a configured origin is still written out text
fetch(`${config.origin}/api/catalog`);
```

Code this rule accepts.

```ts
// a destination read from configuration passes
fetch(config.catalogEndpoint);
```

```ts
// a link written in markup is not an argument of a call that opens a connection
document.body.innerHTML = `<a href="https://vite.dev/" target="_blank">Vite</a>`;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Taking the destination into a variable before handing it over (`const url = 'https://...'; fetch(url);`). The judgment reads only the expression in the destination position, so the report clears. The destination is still baked into this file, and for a reader it is worse by the distance between where it was written and the call
- Wrapping the destination in a function and calling that (`fetch(catalogEndpoint())` where that function returns a string). As above. A function that does not read from configuration has only moved the destination
- Writing out only the path and taking the origin from configuration. Part of the destination is still baked in, and it cannot connect to a host with a different path structure
- Splitting the string and concatenating (`'https://' + 'example.test'`). Concatenation reads both sides
- Wrapping `fetch` under another name and calling that. All that changed is that the judgment knows one fewer call; the destination is still baked in. Where a client is wrapped, adding that wrapper to this rule's list is the paired work
- Keeping it because it is a test, or because it is for development. There is no exemption by file kind. Where a test needs a destination, it comes from the test's configuration
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `hardcodedEndpoint` | A call that opens a connection must not take its destination from text written out in this file. Read the destination from configuration and pass it in: take it from the environment the process was started with, or accept it as a parameter of the function that performs the request. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
