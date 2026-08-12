import { describe, expect, test } from "vite-plus/test";

import { isOutOfScopeSource } from "./out-of-scope-source.ts";

const it = test
  .extend("verdictOnTypeScriptTest", () =>
    isOutOfScopeSource("packages/order/src/order-status.test.ts"))
  .extend("verdictOnComponentSpec", () =>
    isOutOfScopeSource("packages/order/src/order-status.spec.tsx"),
  )
  .extend("verdictOnModuleTest", () =>
    isOutOfScopeSource("packages/order/src/order-status.test.mjs"),
  )
  .extend("verdictOnPluralStory", () =>
    isOutOfScopeSource("packages/order/src/order-status.stories.tsx"),
  )
  .extend("verdictOnSingularStory", () =>
    isOutOfScopeSource("packages/order/src/order-status.story.tsx"),
  )
  .extend("verdictOnFixturesDirectory", () =>
    isOutOfScopeSource("packages/order/fixtures/order-status.ts"),
  )
  .extend("verdictOnUnderscoredFixturesDirectory", () =>
    isOutOfScopeSource("packages/order/__fixtures__/order-status.ts"),
  )
  .extend("verdictOnUnderscoredMocksDirectory", () =>
    isOutOfScopeSource("packages/order/__mocks__/order-status.ts"),
  )
  .extend("verdictOnUnderscoredStoriesDirectory", () =>
    isOutOfScopeSource("packages/order/__stories__/order-status.ts"),
  )
  .extend("verdictOnUnderscoredTestsDirectory", () =>
    isOutOfScopeSource("packages/order/__tests__/order-status.ts"),
  )
  .extend("verdictOnTestDirectory", () => isOutOfScopeSource("packages/order/test/order-status.ts"))
  .extend("verdictOnTestsDirectory", () =>
    isOutOfScopeSource("packages/order/tests/order-status.ts"),
  )
  .extend("verdictOnWindowsFixturesDirectory", () =>
    isOutOfScopeSource("packages\\order\\fixtures\\order-status.ts"),
  )
  .extend("verdictOnWindowsTestFile", () =>
    isOutOfScopeSource("packages\\order\\src\\order-status.test.ts"),
  )
  .extend("verdictOnProductionSource", () =>
    isOutOfScopeSource("packages/order/src/order-status.ts"),
  )
  .extend("verdictOnSourceNamedAfterTests", () =>
    isOutOfScopeSource("packages/order/src/test-helpers.ts"),
  )
  .extend("verdictOnSourceEndingInTest", () => isOutOfScopeSource("packages/order/src/latest.ts"))
  .extend("verdictOnPackageNamedAfterTesting", () =>
    isOutOfScopeSource("packages/testing-library/src/order-status.ts"),
  );

describe("out-of-scope-source", () => {
  it("a test source is out of scope", ({ verdictOnTypeScriptTest }) => {
    expect(verdictOnTypeScriptTest).toBe(true);
  });

  it("a spec source carrying the component extension is out of scope", ({
    verdictOnComponentSpec,
  }) => {
    expect(verdictOnComponentSpec).toBe(true);
  });

  it("a test source carrying the module extension is out of scope", ({ verdictOnModuleTest }) => {
    expect(verdictOnModuleTest).toBe(true);
  });

  it("a story spelled in the plural is out of scope", ({ verdictOnPluralStory }) => {
    expect(verdictOnPluralStory).toBe(true);
  });

  it("a story spelled in the singular is out of scope", ({ verdictOnSingularStory }) => {
    expect(verdictOnSingularStory).toBe(true);
  });

  it("a file under a fixtures directory is out of scope", ({ verdictOnFixturesDirectory }) => {
    expect(verdictOnFixturesDirectory).toBe(true);
  });

  it("a file under an underscored fixtures directory is out of scope", ({
    verdictOnUnderscoredFixturesDirectory,
  }) => {
    expect(verdictOnUnderscoredFixturesDirectory).toBe(true);
  });

  it("a file under an underscored mocks directory is out of scope", ({
    verdictOnUnderscoredMocksDirectory,
  }) => {
    expect(verdictOnUnderscoredMocksDirectory).toBe(true);
  });

  it("a file under an underscored stories directory is out of scope", ({
    verdictOnUnderscoredStoriesDirectory,
  }) => {
    expect(verdictOnUnderscoredStoriesDirectory).toBe(true);
  });

  it("a file under an underscored tests directory is out of scope", ({
    verdictOnUnderscoredTestsDirectory,
  }) => {
    expect(verdictOnUnderscoredTestsDirectory).toBe(true);
  });

  it("a file under a test directory is out of scope", ({ verdictOnTestDirectory }) => {
    expect(verdictOnTestDirectory).toBe(true);
  });

  it("a file under a tests directory is out of scope", ({ verdictOnTestsDirectory }) => {
    expect(verdictOnTestsDirectory).toBe(true);
  });

  it("a windows path names its fixtures directory on its own separator", ({
    verdictOnWindowsFixturesDirectory,
  }) => {
    expect(verdictOnWindowsFixturesDirectory).toBe(true);
  });

  it("a windows path names its test file on its own separator", ({ verdictOnWindowsTestFile }) => {
    expect(verdictOnWindowsTestFile).toBe(true);
  });

  it("a production source stays in scope", ({ verdictOnProductionSource }) => {
    expect(verdictOnProductionSource).toBe(false);
  });

  it("a source whose name opens with the word test stays in scope", ({
    verdictOnSourceNamedAfterTests,
  }) => {
    expect(verdictOnSourceNamedAfterTests).toBe(false);
  });

  it("a source whose name ends in the word test stays in scope", ({
    verdictOnSourceEndingInTest,
  }) => {
    expect(verdictOnSourceEndingInTest).toBe(false);
  });

  it("a package whose name carries the word testing stays in scope", ({
    verdictOnPackageNamedAfterTesting,
  }) => {
    expect(verdictOnPackageNamedAfterTesting).toBe(false);
  });
});
