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

Text written out in the source standing in the destination argument of a call that opens a connection. The destination is the first argument of `fetch(...)`, `<receiver>.fetch(...)`, `navigator.sendBeacon(...)`, `new Request(...)`, `new WebSocket(...)` and `new EventSource(...)`.

The shape of the literal is never read, only where it is handed. An expression counts as written out when it holds a string literal, a non-empty static part of a template, or either side of a `+` concatenation holding one of those — so a configured origin with a path baked onto it is reported, while a destination assembled from values alone is not.

There is no exemption by file kind. A URL in markup, in an expected value, or in a constant handed nowhere never enters a destination position and is never read.

## Fix

Read the destination from configuration and hand it in: take it from the environment the process was started with, or accept it as a parameter of the function that performs the request.

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

- Moving the destination into a variable, or behind a function that returns it. Only the expression in the destination position is read
- Writing out only the path and taking the origin from configuration. The path is part of the destination
- Wrapping the client under another name. The destination is still baked in; add the wrapper to this rule instead

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
