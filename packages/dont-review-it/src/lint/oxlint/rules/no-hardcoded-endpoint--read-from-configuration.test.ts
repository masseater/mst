import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noHardcodedEndpoint } from "./no-hardcoded-endpoint--read-from-configuration.ts";

describe("dont-review-it/no-hardcoded-endpoint--read-from-configuration", () => {
  testLintRule(noHardcodedEndpoint, {
    valid: [
      {
        name: "a destination read from configuration passes",
        code: "fetch(config.catalogEndpoint);",
      },
      {
        name: "a call handed no destination at all writes none out",
        code: "fetch();",
      },
      {
        name: "a destination spread in from elsewhere is not written out here",
        code: "fetch(...destinations);",
      },
      {
        name: "a destination taken from the environment passes",
        code: "fetch(process.env.CATALOG_ENDPOINT);",
      },
      {
        name: "a destination assembled only from values passes",
        code: "fetch(`${origin}${path}`);",
      },
      {
        name: "a destination concatenated only from values passes",
        code: "fetch(origin + path);",
      },
      {
        name: "written out text in the request options is not the destination",
        code: "fetch(endpoint, { method: 'POST' });",
      },
      {
        name: "a link written in markup is not an argument of a call that opens a connection",
        code: 'document.body.innerHTML = `<a href="https://vite.dev/" target="_blank">Vite</a>`;',
      },
      {
        name: "an address assigned to a property is not an argument of a call that opens a connection",
        code: "anchor.href = 'https://vite.dev/';",
      },
      {
        name: "a written out address that no call sends anywhere is outside this rule",
        code: "const DOCS = 'https://github.com/masseater/mst';\nexport const docs = DOCS;",
      },
      {
        name: "an address compared against in a test is not a destination",
        code: "expect(docsUrl()).toBe('https://github.com/masseater/mst/blob/main/docs.md');",
      },
      {
        name: "a call named fetch is judged, a call named after something else is not",
        code: "load('https://example.test/catalog');",
      },
      {
        name: "a map lookup that happens to take written out text is not a connection",
        code: "cache.get('https://example.test/catalog');",
      },
      {
        name: "constructing a value that does not open a connection is outside this rule",
        code: "new Error('https://example.test/catalog');",
      },
      {
        name: "a connection constructed with no argument at all has no destination",
        code: "new Request(target);",
      },
    ],
    invalid: [
      {
        name: "a written out destination passed to fetch is reported",
        code: "fetch('https://example.test/catalog');",
        errors: [{ messageId: "hardcodedEndpoint" }],
      },
      {
        name: "a path written out at the destination is reported even without a host",
        code: "fetch('/api/catalog');",
        errors: [{ messageId: "hardcodedEndpoint" }],
      },
      {
        name: "fetch reached through a receiver is the same call",
        code: "globalThis.fetch('https://example.test/catalog');",
        errors: [{ messageId: "hardcodedEndpoint" }],
      },
      {
        name: "a template literal with a written out host is written out text",
        code: "fetch(`https://example.test/catalog/${id}`);",
        errors: [{ messageId: "hardcodedEndpoint" }],
      },
      {
        name: "a written out path appended to a configured origin is still written out text",
        code: "fetch(`${config.origin}/api/catalog`);",
        errors: [{ messageId: "hardcodedEndpoint" }],
      },
      {
        name: "concatenation carries written out text just as a template literal does",
        code: "fetch(config.origin + '/api/catalog');",
        errors: [{ messageId: "hardcodedEndpoint" }],
      },
      {
        name: "parentheses around the destination do not change where it goes",
        code: "fetch(('https://example.test/catalog'));",
        errors: [{ messageId: "hardcodedEndpoint" }],
      },
      {
        name: "a request built with a written out destination is reported",
        code: "new Request('https://example.test/catalog');",
        errors: [{ messageId: "hardcodedEndpoint" }],
      },
      {
        name: "a socket opened at a written out destination is reported",
        code: "new WebSocket('wss://example.test/live');",
        errors: [{ messageId: "hardcodedEndpoint" }],
      },
      {
        name: "an event source opened at a written out destination is reported",
        code: "new EventSource('https://example.test/events');",
        errors: [{ messageId: "hardcodedEndpoint" }],
      },
      {
        name: "a beacon sent to a written out destination is reported",
        code: "navigator.sendBeacon('https://example.test/collect', payload);",
        errors: [{ messageId: "hardcodedEndpoint" }],
      },
      {
        name: "each call is reported on its own",
        code: "fetch('https://example.test/a');\nfetch('https://example.test/b');",
        errors: [{ messageId: "hardcodedEndpoint" }, { messageId: "hardcodedEndpoint" }],
      },
      {
        name: "a test file carries no exemption",
        code: "fetch('https://example.test/catalog');",
        filename: "/repo/packages/utils/src/catalog.test.ts",
        errors: [{ messageId: "hardcodedEndpoint" }],
      },
    ],
  });
});
