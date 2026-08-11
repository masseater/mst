import { describe, expect, test } from "vite-plus/test";

import { specDirectoryNamesFrom, specDirectoryOf } from "./spec-directories.ts";

const DEFAULT_NAMES = specDirectoryNamesFrom([]);

describe("spec-directories", () => {
  test("a file directly under a directory carrying one of those names sits in a spec directory", () => {
    expect(
      specDirectoryOf({ relativePath: "packages/alpha/test/order.ts", names: DEFAULT_NAMES }),
    ).toBe("packages/alpha/test");
  });

  test("a file nested deeper under a spec directory sits in the same spec directory", () => {
    expect(
      specDirectoryOf({ relativePath: "packages/alpha/test/orders/held.ts", names: DEFAULT_NAMES }),
    ).toBe("packages/alpha/test");
  });

  test("the outermost directory carrying the name is the one the file sits in", () => {
    expect(specDirectoryOf({ relativePath: "test/alpha/spec/held.ts", names: DEFAULT_NAMES })).toBe(
      "test",
    );
  });

  test("a file outside every directory carrying one of those names sits in no spec directory", () => {
    expect(
      specDirectoryOf({ relativePath: "packages/alpha/src/order.ts", names: DEFAULT_NAMES }),
    ).toBe(null);
  });

  test("a file whose own name carries a spec directory name sits in no spec directory", () => {
    expect(specDirectoryOf({ relativePath: "packages/alpha/test", names: DEFAULT_NAMES })).toBe(
      null,
    );
  });

  test("a rule run without settings reads the directory names the rule itself carries", () => {
    const carried = new Set(["__specs__", "__tests__", "spec", "specs", "test", "tests"]);
    expect(specDirectoryNamesFrom([])).toStrictEqual(carried);
    expect(specDirectoryNamesFrom([{}])).toStrictEqual(carried);
  });

  test("a repository that names its spec directories differently replaces the names entirely", () => {
    expect(specDirectoryNamesFrom([{ specDirectoryNames: ["cases"] }])).toStrictEqual(
      new Set(["cases"]),
    );
  });

  test("an empty name list leaves the rule's own names in place", () => {
    expect(specDirectoryNamesFrom([{ specDirectoryNames: [] }])).toStrictEqual(DEFAULT_NAMES);
  });
});
