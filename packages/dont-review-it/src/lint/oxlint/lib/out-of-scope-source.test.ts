import { describe, expect, test } from "vite-plus/test";

import { isOutOfScopeSource } from "./out-of-scope-source.ts";

describe("out-of-scope-source", () => {
  test("a test source is out of scope whichever extension it carries", () => {
    expect(isOutOfScopeSource("packages/order/src/order-status.test.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/src/order-status.spec.tsx")).toBe(true);
    expect(isOutOfScopeSource("packages/order/src/order-status.test.mjs")).toBe(true);
    expect(isOutOfScopeSource("packages/order/src/order-status.test.helper.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/src/order-status.test-d.ts")).toBe(true);
  });

  test("a story is out of scope in both spellings", () => {
    expect(isOutOfScopeSource("packages/order/src/order-status.stories.tsx")).toBe(true);
    expect(isOutOfScopeSource("packages/order/src/order-status.story.tsx")).toBe(true);
    expect(isOutOfScopeSource("packages/order/src/Owner.stories.fixture.ts")).toBe(true);
  });

  test("fixture and mock filename suffixes are out of scope", () => {
    expect(isOutOfScopeSource("packages/order/src/order-status.fixture.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/src/order-status.mock.tsx")).toBe(true);
    expect(isOutOfScopeSource("packages/order/src/order-status.fixture.helper.ts")).toBe(true);
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

  test("generated and cache directories are out of scope", () => {
    expect(isOutOfScopeSource("packages/order/dist/order-status.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/dist-ssr/order-status.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/coverage/order-status.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/.cache/order-status.ts")).toBe(true);
    expect(isOutOfScopeSource("packages/order/.local-agents/order-status.ts")).toBe(true);
  });

  test("dependency internals stay external when their own paths use scope names", () => {
    expect(isOutOfScopeSource("node_modules/library/dist/index.d.ts")).toBe(false);
    expect(isOutOfScopeSource("node_modules/library/fixtures/index.d.ts")).toBe(false);
  });

  test("a windows path is split on its own separator", () => {
    expect(isOutOfScopeSource("packages\\order\\fixtures\\order-status.ts")).toBe(true);
    expect(isOutOfScopeSource("packages\\order\\src\\order-status.test.ts")).toBe(true);
  });

  test("a production source stays in scope even when the words appear inside a name", () => {
    expect(isOutOfScopeSource("packages/order/src/order-status.ts")).toBe(false);
    expect(isOutOfScopeSource("packages/order/src/test-helpers.ts")).toBe(false);
    expect(isOutOfScopeSource("packages/order/src/contest.helper.ts")).toBe(false);
    expect(isOutOfScopeSource("packages/order/src/latest.ts")).toBe(false);
    expect(isOutOfScopeSource("packages/testing-library/src/order-status.ts")).toBe(false);
  });

  test("scope words above the repository root do not exclude production", () => {
    const repositoryRoot = "/private/tmp/tests/canonical-values-checkout";
    expect(
      isOutOfScopeSource(`${repositoryRoot}/packages/order/src/order-status.ts`, repositoryRoot),
    ).toBe(false);
    expect(
      isOutOfScopeSource(
        `${repositoryRoot}/packages/order/fixtures/order-status.ts`,
        repositoryRoot,
      ),
    ).toBe(true);
  });
});
