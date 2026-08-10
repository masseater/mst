import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noHardcodedProviderId } from "./no-hardcoded-provider-id--read-from-configuration.ts";

describe("dont-review-it/no-hardcoded-provider-id--read-from-configuration", () => {
  testLintRule(noHardcodedProviderId, {
    valid: [
      {
        name: "an identity read from configuration passes",
        code: "import Provider from 'provider-sdk';\nnew Provider({ projectId: config.projectId });",
      },
      {
        name: "an identity taken from the environment passes",
        code: "import Provider from 'provider-sdk';\nnew Provider({ apiKey: process.env.PROVIDER_API_KEY });",
      },
      {
        name: "an identity behind a computed name cannot be read as an identity key",
        code: "import Provider from 'provider-sdk';\nnew Provider({ [field]: 'written-out' });",
      },
      {
        name: "a key that is a number names no identity",
        code: "import Provider from 'provider-sdk';\nnew Provider({ 1: 'written-out' });",
      },
      {
        name: "settings spread in from elsewhere are not written out here",
        code: "import Provider from 'provider-sdk';\nnew Provider({ ...base });",
      },
      {
        name: "an argument spread in from elsewhere is not written out here",
        code: "import Provider from 'provider-sdk';\nnew Provider(...settings);",
      },
      {
        name: "a constructor reached through a computed name is not a provider constructor",
        code: "import Provider from 'provider-sdk';\nnew providers[0]({ apiKey: 'written-out' });",
      },
      {
        name: "a setting that is not an identity may be written out",
        code: "import { RuleTester } from '@oxlint/plugins';\nnew RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });",
      },
      {
        name: "a working directory is not an identity",
        code: "import { API } from '@manypkg/api';\nnew API({ cwd: packageDirectory });",
      },
      {
        name: "a client built from a module of this repository is not a provider client",
        code: "import { Client } from './client.ts';\nnew Client({ apiKey: 'written-out' });",
      },
      {
        name: "a client built from a subpath import of this repository is not a provider client",
        code: "import { Client } from '#internal/client.ts';\nnew Client({ apiKey: 'written-out' });",
      },
      {
        name: "a construction from the platform is not a provider client",
        code: "import { Agent } from 'node:https';\nnew Agent({ token: 'written-out' });",
      },
      {
        name: "a construction of a binding that was never imported is not a provider client",
        code: "new Provider({ projectId: 'acme-production' });",
      },
      {
        name: "an identity name written out as a bare value is not passed to a provider client",
        code: "export const PROJECT_ID = 'acme-production';",
      },
      {
        name: "calling a provider package is not building a client with it",
        code: "import { configure } from 'provider-sdk';\nconfigure({ projectId: 'acme-production' });",
      },
      {
        name: "a provider client given no arguments has no identity to report",
        code: "import Provider from 'provider-sdk';\nnew Provider();",
      },
    ],
    invalid: [
      {
        name: "a written out project identifier passed to a provider client is reported",
        code: "import Provider from 'provider-sdk';\nnew Provider({ projectId: 'acme-production' });",
        errors: [{ messageId: "hardcodedProviderId" }],
      },
      {
        name: "a written out key passed to a provider client is reported",
        code: "import { Provider } from 'provider-sdk';\nnew Provider({ apiKey: 'written-out-secret' });",
        errors: [{ messageId: "hardcodedProviderId" }],
      },
      {
        name: "a provider client reached through a namespace import is the same construction",
        code: "import * as sdk from 'provider-sdk';\nnew sdk.Provider({ accountId: 'acme-production' });",
        errors: [{ messageId: "hardcodedProviderId" }],
      },
      {
        name: "a scoped provider package is a provider package",
        code: "import Provider from '@vendor/provider-sdk';\nnew Provider({ tenantId: 'acme' });",
        errors: [{ messageId: "hardcodedProviderId" }],
      },
      {
        name: "an identity nested inside the options is reported",
        code: "import Provider from 'provider-sdk';\nnew Provider({ auth: { clientSecret: 'written-out-secret' } });",
        errors: [{ messageId: "hardcodedProviderId" }],
      },
      {
        name: "an identity written out with a string key is reported",
        code: "import Provider from 'provider-sdk';\nnew Provider({ 'apiKey': 'written-out-secret' });",
        errors: [{ messageId: "hardcodedProviderId" }],
      },
      {
        name: "an identity assembled with a written out prefix is still written out",
        code: "import Provider from 'provider-sdk';\nnew Provider({ projectId: `acme-${stage}` });",
        errors: [{ messageId: "hardcodedProviderId" }],
      },
      {
        name: "an identity concatenated with a written out part is still written out",
        code: "import Provider from 'provider-sdk';\nnew Provider({ projectId: 'acme-' + stage });",
        errors: [{ messageId: "hardcodedProviderId" }],
      },
      {
        name: "an identity in a later argument is reported",
        code: "import Provider from 'provider-sdk';\nnew Provider(transport, { apiKey: 'written-out-secret' });",
        errors: [{ messageId: "hardcodedProviderId" }],
      },
      {
        name: "each written out identity is reported on its own",
        code: "import Provider from 'provider-sdk';\nnew Provider({ projectId: 'acme-production', apiKey: 'written-out-secret' });",
        errors: [{ messageId: "hardcodedProviderId" }, { messageId: "hardcodedProviderId" }],
      },
      {
        name: "a test file carries no exemption",
        code: "import Provider from 'provider-sdk';\nnew Provider({ projectId: 'acme-production' });",
        filename: "/repo/packages/utils/src/provider.test.ts",
        errors: [{ messageId: "hardcodedProviderId" }],
      },
    ],
  });
});
