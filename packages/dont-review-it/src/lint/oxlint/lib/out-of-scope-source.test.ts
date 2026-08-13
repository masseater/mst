import { describe, expect, test } from "vite-plus/test";

import { isOutOfScopeSource } from "./out-of-scope-source.ts";

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

  describe("a path written on the windows separator", () => {
    describe("a path holding a fixtures directory", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages\\order\\fixtures\\order-status.ts"));

      it("names its fixtures directory on its own separator and falls out of scope", ({
        outOfScope,
      }) => {
        expect(outOfScope).toBe(true);
      });
    });

    describe("a path naming a test file", () => {
      const it = test.extend("outOfScope", () =>
        isOutOfScopeSource("packages\\order\\src\\order-status.test.ts"));

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
});
