import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { isOutOfScopeLintSource, isOutOfScopeSource } from "./out-of-scope-source.ts";

const CHECKOUT_UNDER_A_TESTS_DIRECTORY = "/private/tmp/tests/canonical-values-checkout";

describe("isOutOfScopeSource", () => {
  describe("a name carrying a suffix the runner claims", () => {
    describe("a test source", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/order-status.test.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a spec source carrying the component extension", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/order-status.spec.tsx"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a test source carrying the module extension", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/order-status.test.mjs"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a test source carrying a further word after the claimed suffix", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/order-status.test.helper.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a type test source spelled with a dash", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/order-status.test-d.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a story spelled in the plural", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/order-status.stories.tsx"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a story spelled in the singular", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/order-status.story.tsx"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a story followed by a fixture word", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/Owner.stories.fixture.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a fixture source", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/order-status.fixture.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a mock source carrying the component extension", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/order-status.mock.tsx"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a fixture source carrying a further word after the claimed suffix", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/order-status.fixture.helper.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });
  });

  describe("a path holding a directory the runner claims", () => {
    describe("a file under a fixtures directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/fixtures/order-status.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a file under an underscored fixtures directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/__fixtures__/order-status.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a file under an underscored mocks directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/__mocks__/order-status.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a file under an underscored stories directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/__stories__/order-status.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a file under an underscored tests directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/__tests__/order-status.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a file under a test directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/test/order-status.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a file under a tests directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/tests/order-status.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });
  });

  describe("a path holding a directory the build writes", () => {
    describe("a file under a dist directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/dist/order-status.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a file under a server-rendered dist directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/dist-ssr/order-status.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a file under a coverage directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/coverage/order-status.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a file under a cache directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/.cache/order-status.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a file under the agent scratch directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/.local-agents/order-status.ts"));

      it("is out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });
  });

  describe("a path reaching inside an installed dependency", () => {
    describe("a dependency file under a dist directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("node_modules/library/dist/index.d.ts"));

      it("stays external rather than out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(false);
      });
    });

    describe("a dependency file under a fixtures directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("node_modules/library/fixtures/index.d.ts"));

      it("stays external rather than out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(false);
      });
    });
  });

  describe("a path written on the windows separator", () => {
    describe("a path holding a fixtures directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource(String.raw`packages\order\fixtures\order-status.ts`));

      it("names its fixtures directory on its own separator and falls out of scope", ({
        outOfScope,
      }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a path naming a test file", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource(String.raw`packages\order\src\order-status.test.ts`));

      it("names its test file on its own separator and falls out of scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });
  });

  describe("a path the runner claims nothing of", () => {
    describe("a production source", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/order-status.ts"));

      it("stays in scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(false);
      });
    });

    describe("a source whose name opens with the word test", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/test-helpers.ts"));

      it("stays in scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(false);
      });
    });

    describe("a source whose first word ends in the word test", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/contest.helper.ts"));

      it("stays in scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(false);
      });
    });

    describe("a source whose name ends in the word test", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/order/src/latest.ts"));

      it("stays in scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(false);
      });
    });

    describe("a package whose name carries the word testing", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages/testing-library/src/order-status.ts"));

      it("stays in scope", ({ outOfScope }) => {
        expect(outOfScope).toBe(false);
      });
    });
  });

  describe("a repository root whose own path carries a claimed word", () => {
    describe("a production source below that root", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource(
          `${CHECKOUT_UNDER_A_TESTS_DIRECTORY}/packages/order/src/order-status.ts`,
          CHECKOUT_UNDER_A_TESTS_DIRECTORY,
        ));

      it("stays in scope, because the words above the root are not read", ({ outOfScope }) => {
        expect(outOfScope).toBe(false);
      });
    });

    describe("a fixtures directory below that root", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource(
          `${CHECKOUT_UNDER_A_TESTS_DIRECTORY}/packages/order/fixtures/order-status.ts`,
          CHECKOUT_UNDER_A_TESTS_DIRECTORY,
        ));

      it("is out of scope on the words below the root", ({ outOfScope }) => {
        expect(outOfScope).toBe(true);
      });
    });
  });
});

describe("isOutOfScopeLintSource", () => {
  describe("a source that exists below the repository root", () => {
    const it = test.extend("outOfScopeForLint", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "out-of-scope-source-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"));
      const writtenSource = join(repositoryRoot, "src/status.ts");
      writeFileSync(writtenSource, "export {};\n");
      return isOutOfScopeLintSource(writtenSource, repositoryRoot);
    });

    it("reads it against the root and keeps it in scope", ({ outOfScopeForLint }) => {
      expect(outOfScopeForLint).toBe(false);
    });
  });

  describe("a source that does not exist", () => {
    const it = test.extend("outOfScopeForLint", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "out-of-scope-source-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return isOutOfScopeLintSource("tests/missing.ts", repositoryRoot);
    });

    it("reads it on its written path alone and falls out of scope", ({ outOfScopeForLint }) => {
      expect(outOfScopeForLint).toBe(true);
    });
  });
});
