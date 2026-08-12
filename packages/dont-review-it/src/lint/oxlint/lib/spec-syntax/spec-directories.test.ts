import { describe, expect, test } from "vite-plus/test";

import { specDirectoryNamesFrom, specDirectoryOf } from "./spec-directories.ts";

const DEFAULT_NAMES: ReadonlySet<string> = new Set([
  "__specs__",
  "__tests__",
  "spec",
  "specs",
  "test",
  "tests",
]);

const it = test
  .extend("directoryOfFileDirectlyUnderASpecDirectory", () =>
    specDirectoryOf({ relativePath: "packages/alpha/test/order.ts", names: DEFAULT_NAMES }))
  .extend("directoryOfFileNestedDeeper", () =>
    specDirectoryOf({ relativePath: "packages/alpha/test/orders/held.ts", names: DEFAULT_NAMES }),
  )
  .extend("directoryOfFileUnderTwoNamedDirectories", () =>
    specDirectoryOf({ relativePath: "test/alpha/spec/held.ts", names: DEFAULT_NAMES }),
  )
  .extend("directoryOfFileOutsideEveryNamedDirectory", () =>
    specDirectoryOf({ relativePath: "packages/alpha/src/order.ts", names: DEFAULT_NAMES }),
  )
  .extend("directoryOfPathWhoseOwnNameIsASpecName", () =>
    specDirectoryOf({ relativePath: "packages/alpha/test", names: DEFAULT_NAMES }),
  )
  .extend("namesReadWithoutSettings", () => specDirectoryNamesFrom([]))
  .extend("namesReadFromEmptySettings", () => specDirectoryNamesFrom([{}]))
  .extend("namesReadFromReplacedList", () =>
    specDirectoryNamesFrom([{ specDirectoryNames: ["cases"] }]),
  )
  .extend("namesReadFromEmptyList", () => specDirectoryNamesFrom([{ specDirectoryNames: [] }]));

describe("spec-directories", () => {
  it("a file directly under a directory carrying one of those names sits in a spec directory", ({
    directoryOfFileDirectlyUnderASpecDirectory,
  }) => {
    expect(directoryOfFileDirectlyUnderASpecDirectory).toBe("packages/alpha/test");
  });

  it("a file nested deeper under a spec directory sits in the same spec directory", ({
    directoryOfFileNestedDeeper,
  }) => {
    expect(directoryOfFileNestedDeeper).toBe("packages/alpha/test");
  });

  it("the outermost directory carrying the name is the one the file sits in", ({
    directoryOfFileUnderTwoNamedDirectories,
  }) => {
    expect(directoryOfFileUnderTwoNamedDirectories).toBe("test");
  });

  it("a file outside every directory carrying one of those names sits in no spec directory", ({
    directoryOfFileOutsideEveryNamedDirectory,
  }) => {
    expect(directoryOfFileOutsideEveryNamedDirectory).toBe(null);
  });

  it("a file whose own name carries a spec directory name sits in no spec directory", ({
    directoryOfPathWhoseOwnNameIsASpecName,
  }) => {
    expect(directoryOfPathWhoseOwnNameIsASpecName).toBe(null);
  });

  it("a rule run without settings reads the directory names the rule itself carries", ({
    namesReadWithoutSettings,
  }) => {
    expect(namesReadWithoutSettings).toStrictEqual(DEFAULT_NAMES);
  });

  it("settings that name no spec directory leave the rule's own names in place", ({
    namesReadFromEmptySettings,
  }) => {
    expect(namesReadFromEmptySettings).toStrictEqual(DEFAULT_NAMES);
  });

  it("a repository that names its spec directories differently replaces the names entirely", ({
    namesReadFromReplacedList,
  }) => {
    expect(namesReadFromReplacedList).toStrictEqual(new Set(["cases"]));
  });

  it("an empty name list leaves the rule's own names in place", ({ namesReadFromEmptyList }) => {
    expect(namesReadFromEmptyList).toStrictEqual(DEFAULT_NAMES);
  });
});
