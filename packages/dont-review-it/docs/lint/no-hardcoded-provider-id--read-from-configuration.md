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
- Bundle: `writing`
- Source: [`no-hardcoded-provider-id--read-from-configuration.ts`](../../src/lint/oxlint/rules/writing/no-hardcoded-provider-id--read-from-configuration.ts)

<!-- END GENERATED rule-header -->

## Violation

Text written out in the source standing at an identity argument of a client built from a provider package. A provider package is a bare specifier, so this repository's own modules and `node:` builtins are outside it; the constructor may be a named, default or namespace import.

An identity is the value of a property whose key names one of `accessKeyId`, `accessToken`, `accountId`, `apiKey`, `apiSecret`, `apiToken`, `appId`, `applicationId`, `authToken`, `clientId`, `clientSecret`, `dsn`, `organizationId`, `privateKey`, `projectId`, `publicKey`, `secretAccessKey`, `tenantId`, `token` or `workspaceId`. Nested objects are walked, and a key whose name settles only at run time cannot be read.

An expression counts as written out when it holds a string literal, a non-empty static part of a template, or either side of a `+` concatenation holding one of those. A positional argument, and a client built through a function call, are outside this reading; settings such as `region` and destinations such as `baseURL` are not identities.

## Fix

Read the identity from configuration and hand it in: take it from the environment the process was started with, or accept it as a parameter of the function that builds the client.

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

- Moving the identity into a variable first. Only the expression in the identity position is read
- Wrapping the provider's constructor in a class of this repository. The specifier stops being a provider package while the identity stays baked in
- Renaming the key to something outside the list. Key names are settled by the provider's API

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
