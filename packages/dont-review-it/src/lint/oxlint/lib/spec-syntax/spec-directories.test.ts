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

describe("specDirectoryOf", () => {
  describe("a file directly under a directory carrying one of those names", () => {
    const it = test.extend("specDirectory", () =>
      specDirectoryOf({ relativePath: "packages/alpha/test/order.ts", names: DEFAULT_NAMES }));

    it("sits in that spec directory", ({ specDirectory }) => {
      expect(specDirectory).toBe("packages/alpha/test");
    });
  });

  describe("a file nested deeper under a spec directory", () => {
    const it = test.extend("specDirectory", () =>
      specDirectoryOf({
        relativePath: "packages/alpha/test/orders/held.ts",
        names: DEFAULT_NAMES,
      }));

    it("sits in the same spec directory", ({ specDirectory }) => {
      expect(specDirectory).toBe("packages/alpha/test");
    });
  });

  describe("a file under two directories carrying those names", () => {
    const it = test.extend("specDirectory", () =>
      specDirectoryOf({ relativePath: "test/alpha/spec/held.ts", names: DEFAULT_NAMES }));

    it("sits in the outermost directory carrying the name", ({ specDirectory }) => {
      expect(specDirectory).toBe("test");
    });
  });

  describe("a file outside every directory carrying one of those names", () => {
    const it = test.extend("specDirectory", () =>
      specDirectoryOf({ relativePath: "packages/alpha/src/order.ts", names: DEFAULT_NAMES }));

    it("sits in no spec directory", ({ specDirectory }) => {
      expect(specDirectory).toBe(null);
    });
  });

  describe("a path whose own last segment carries a spec directory name", () => {
    const it = test.extend("specDirectory", () =>
      specDirectoryOf({ relativePath: "packages/alpha/test", names: DEFAULT_NAMES }));

    it("sits in no spec directory", ({ specDirectory }) => {
      expect(specDirectory).toBe(null);
    });
  });
});

describe("specDirectoryNamesFrom", () => {
  describe("a rule run without settings", () => {
    const it = test.extend("specDirectoryNames", () => specDirectoryNamesFrom([]));

    it("reads the directory names the rule itself carries", ({ specDirectoryNames }) => {
      expect(specDirectoryNames).toStrictEqual(DEFAULT_NAMES);
    });
  });

  describe("settings that name no spec directory", () => {
    const it = test.extend("specDirectoryNames", () => specDirectoryNamesFrom([{}]));

    it("leave the rule's own names in place", ({ specDirectoryNames }) => {
      expect(specDirectoryNames).toStrictEqual(DEFAULT_NAMES);
    });
  });

  describe("a repository that names its spec directories differently", () => {
    const it = test.extend("specDirectoryNames", () =>
      specDirectoryNamesFrom([{ specDirectoryNames: ["cases"] }]));

    it("replaces the names entirely", ({ specDirectoryNames }) => {
      expect(specDirectoryNames).toStrictEqual(new Set(["cases"]));
    });
  });

  describe("settings carrying an empty name list", () => {
    const it = test.extend("specDirectoryNames", () =>
      specDirectoryNamesFrom([{ specDirectoryNames: [] }]));

    it("leave the rule's own names in place", ({ specDirectoryNames }) => {
      expect(specDirectoryNames).toStrictEqual(DEFAULT_NAMES);
    });
  });
});
