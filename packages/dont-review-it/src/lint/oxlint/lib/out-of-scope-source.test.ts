import { describe, expect, test } from "vite-plus/test";

import { isOutOfScopeSource } from "./out-of-scope-source.ts";

describe("out-of-scope-source", () => {
  test("a test source is out of scope whichever extension it carries", () => {
    expect(isOutOfScopeSource("packages/order/src/order-status.test.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/src/order-status.spec.tsx")).toBe(true);
    expect(isOutOfScopeSource("packages/order/src/order-status.test.mjs")).toBe(true);
  });

  test("a story is out of scope in both spellings", () => {
    expect(isOutOfScopeSource("packages/order/src/order-status.stories.tsx")).toBe(true);
    expect(isOutOfScopeSource("packages/order/src/order-status.story.tsx")).toBe(true);
  });

  test("a fixture or test directory is out of scope whatever the file is called", () => {
    expect(isOutOfScopeSource("packages/order/fixtures/order-status.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/__fixtures__/order-status.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/__mocks__/order-status.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/__stories__/order-status.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/__tests__/order-status.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/test/order-status.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/tests/order-status.ts")).toBe(true);
  });

  test("a windows path is split on its own separator", () => {
    expect(isOutOfScopeSource("packages\\order\\fixtures\\order-status.ts")).toBe(true);
    expect(isOutOfScopeSource("packages\\order\\src\\order-status.test.ts")).toBe(true);
  });

  test("a production source stays in scope even when the words appear inside a name", () => {
    expect(isOutOfScopeSource("packages/order/src/order-status.ts")).toBe(false);
    expect(isOutOfScopeSource("packages/order/src/test-helpers.ts")).toBe(false);
    expect(isOutOfScopeSource("packages/order/src/latest.ts")).toBe(false);
    expect(isOutOfScopeSource("packages/testing-library/src/order-status.ts")).toBe(false);
  });
});
