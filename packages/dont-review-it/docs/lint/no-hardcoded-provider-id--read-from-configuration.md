---
description: "Disallow text written out in the source at an identity argument of a client built from a provider package, so which account a deployment acts as is decided by its configuration rather than by the file that builds the client"
---

# no-hardcoded-provider-id--read-from-configuration

<!-- BEGIN GENERATED rule-header -->

Disallow text written out in the source at an identity argument of a client built from a provider package, so which account a deployment acts as is decided by its configuration rather than by the file that builds the client

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-hardcoded-provider-id--read-from-configuration.ts`](../../src/lint/oxlint/rules/no-hardcoded-provider-id--read-from-configuration.ts)

<!-- END GENERATED rule-header -->

## Violation

A string written out in the source appearing in an **identity argument** of a client built from a provider package.

### The judgment runs on where it is handed, not on how it looks

The judgment never reads the shape of the literal. It reads only **where that literal is handed**. Where a string written out in the source stands in an identity position, the report stands, and whether that string looks like a URL or like an identifier is not read at all.

A shape-based judgment does not work here. Most URL-shaped literals in a repository are external links in scaffold-generated pages and expected values in tests that check how a document URL is assembled — and a scaffold's output must not be replaced with a design of one's own, so a shape-based version collides with the norms the moment it is added. Identifier-shaped literals are overwhelmingly rule names, message ids and AST node kinds. A shape-based rule hits none of what should be fixed while reporting all of what must not be. Judge on where it is handed and only values that actually leave are reported, and no list of providers has to be held as an option on the configuration side.

[no-hardcoded-endpoint--read-from-configuration](./no-hardcoded-endpoint--read-from-configuration.md) is written on the same policy. The two differ only in which position they read.

### What counts as initializing a provider client

A `new` expression whose constructor is **a binding imported from a provider package**.

A provider package means a bare module specifier. Specifiers starting with `.`, `/` or `#` are this repository's own modules and are excluded. Specifiers starting with `node:` are the platform rather than a provider and are excluded.

The constructor may be a named import, a default import or a namespace import. `new sdk.Provider(...)` through a namespace counts as the same construction as long as the receiver is a binding of a provider package.

Two things fall outside this boundary, both deliberately.

- **An SDK taking the identity as a positional argument.** `new Provider('acct-123')` is not reported. Reading "any string handed to an external package's constructor" would report arguments that are neither identity nor destination, such as `new Command('build')` — which is exactly the judgment sliding toward shape. On adopting such an SDK, confirm what its constructor's arguments mean and add them to this judgment
- **An SDK building a client through a function call.** `createClient(url, key)` is not reported. It is syntactically indistinguishable from a configuration function such as `defineConfig({...})`, and distinguishing them by name would again be a shape-based judgment. On adopting such an SDK, add that call to this judgment

### What counts as an identity argument

Inside the object handed to the constructor, the value of a property whose key is one of the following is an identity. Nested objects are walked.

`accessKeyId` / `accessToken` / `accountId` / `apiKey` / `apiSecret` / `apiToken` / `appId` / `applicationId` / `authToken` / `clientId` / `clientSecret` / `dsn` / `organizationId` / `privateKey` / `projectId` / `publicKey` / `secretAccessKey` / `tenantId` / `token` / `workspaceId`

The list holds only what settles "as whom do we connect". `region`, `baseURL` and `endpoint` are not in it: the first is a deployment setting but not an identity, and the other two are destinations rather than identities and belong to `no-hardcoded-endpoint--read-from-configuration`. On adopting an SDK that takes the destination at initialization, add that position to that rule's list.

Only non-computed keys are read. `{ ["projectId"]: '...' }` is not reported. That is named under forbidden bypasses.

### What counts as a string written out

The same judgment as `no-hardcoded-endpoint--read-from-configuration`. The identity expression counts as written out where it contains even one of these.

- A string literal
- A non-empty static part of a template literal
- Either side of a `+` concatenation holding one of the above

So ``new Provider({ projectId: `acme-${stage}` })`` is reported: the stage comes from a value, but which organization it is is baked into this file.

### The boundary of the walk

There is no exemption by file kind. Test code is treated the same. There is no reason a test may build a real client with a real identity.

A string written out outside a `new` is out of scope. `export const PROJECT_ID = 'acme-production';` has been handed nowhere. The moment it is handed over, the place it is handed to judges it.

### The invariant

As whom to connect is settled by the configuration that runs the code, not by the code that connects.

The identity handed to a client's initialization settles which account that process acts as in front of the provider. It necessarily differs per environment. The same source has to run as a sandbox account in tests, as a staging account in review and as the real account in production. A string baked into a construction can only ever be one of those.

It breaks in three layers.

The first is that an artefact can hold only one account. A build runs only under the account whoever wrote it had.

The second is that running under the wrong account cannot be observed. An identity is an untyped string, and whether it is right is known only from the result of actually connecting. The tests pass and the type check passes. Where the tests hold a real identity, the tests touch real data — and that they touched it cannot be read from a green test result.

The third is that where an identity doubles as a credential, it enters the history. An `apiKey` or a `clientSecret` enters this repository's history the moment it is written, and deleting it from the current file does not delete it from the history. Revoking it means invalidating it at the provider, which stops every deployment that was using that key. Unlike the first two layers, this cannot be undone after it is noticed.

The string written out is not the problem in itself. It is that string **standing in a client's identity** that builds those three layers.

### Configuration

None. Only whether the rule is on or off is settled by the configuration. The list of identity keys is held by the rule. It is not something that varies per deployment target, and where it changes, the rule itself is repaired.

## Fix

Read the identity from configuration and hand it over. Two ways to take it.

**Take it from the environment that started the process.** Values that differ per deployment go where deployments differ. A credential has no shape that can sit in source at all.

```ts
const client = new Provider({ projectId: process.env.PROVIDER_PROJECT_ID });
```

**Take it as a function parameter.** Let the caller settle as whom to connect. A test hands over the sandbox identity, and the product code hands over the value it read from configuration.

```ts
const openProvider = (identity: ProviderIdentity): Provider =>
  new Provider({ projectId: identity.projectId, apiKey: identity.apiKey });
```

Taking only part of the identity from configuration (`` `acme-${stage}` ``) is not a solution. While the organization part is baked in, it does not run outside that organization. Have the identity arrive from configuration as one value.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a written out project identifier passed to a provider client is reported
import Provider from 'provider-sdk';
new Provider({ projectId: 'acme-production' });
```

```ts
// an identity assembled with a written out prefix is still written out
import Provider from 'provider-sdk';
new Provider({ projectId: `acme-${stage}` });
```

Code this rule accepts.

```ts
// an identity read from configuration passes
import Provider from 'provider-sdk';
new Provider({ projectId: config.projectId });
```

```ts
// a setting that is not an identity may be written out
import { RuleTester } from '@oxlint/plugins';
new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Taking the identity into a variable before handing it over (placing `const projectId = 'acme-production';` above). The judgment reads only the expression in the identity position, so the report clears. The identity is still baked into this file
- Writing the key in computed form (`{ ["projectId"]: '...' }`). The judgment reads non-computed keys only, so the report clears. Neither the value handed over nor where it goes has changed
- Wrapping the provider's constructor in a class of this repository and `new`-ing the wrapper. The constructor becomes a relative import so the report clears. A baked-in identity is still being handed over inside the wrapper
- Using a key name absent from the list (renaming to `project` or `key`). Key names are settled by the provider's API and are not ours to choose. If renaming makes it pass, it is not reaching the provider
- Splitting the identity and concatenating (`'acme' + '-production'`). Concatenation reads both sides
- Keeping it because it is a test, or because it is a sandbox. There is no exemption by file kind. A sandbox identity comes from the test's configuration too
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `hardcodedProviderId` | A client built from a provider package must not take the identity it acts as from text written out in this file. Read the identity from configuration and pass it in: take it from the environment the process was started with, or accept it as a parameter of the function that builds the client. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
