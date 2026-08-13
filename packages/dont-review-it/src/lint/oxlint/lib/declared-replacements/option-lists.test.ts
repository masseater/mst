import { describe, expect, test } from "vite-plus/test";

import { listedUnder } from "./option-lists.ts";

describe("listedUnder", () => {
  describe("options nobody wrote", () => {
    const it = test.extend("declaredReplacements", () => listedUnder([], "declared"));

    it("carries no declared replacements", ({ declaredReplacements }) => {
      expect(declaredReplacements).toStrictEqual([]);
    });
  });

  describe("an option written as something other than an object", () => {
    const it = test.extend("declaredReplacements", () => listedUnder(["declared"], "declared"));

    it("carries no declared replacements", ({ declaredReplacements }) => {
      expect(declaredReplacements).toStrictEqual([]);
    });
  });

  describe("an option written as nothing", () => {
    const it = test.extend("declaredReplacements", () => listedUnder([null], "declared"));

    it("carries no declared replacements", ({ declaredReplacements }) => {
      expect(declaredReplacements).toStrictEqual([]);
    });
  });

  describe("an option written as a list", () => {
    const it = test.extend("declaredReplacements", () => listedUnder([[]], "declared"));

    it("carries no declared replacements under a key", ({ declaredReplacements }) => {
      expect(declaredReplacements).toStrictEqual([]);
    });
  });

  describe("a key written as something other than a list", () => {
    const it = test.extend("declaredReplacements", () =>
      listedUnder([{ declared: "lerna" }], "declared"));

    it("carries no declared replacements", ({ declaredReplacements }) => {
      expect(declaredReplacements).toStrictEqual([]);
    });
  });

  describe("a key nobody wrote", () => {
    const it = test.extend("declaredReplacements", () =>
      listedUnder([{ withdrawn: [] }], "declared"));

    it("carries no declared replacements", ({ declaredReplacements }) => {
      expect(declaredReplacements).toStrictEqual([]);
    });
  });

  describe("entries written as objects", () => {
    const it = test.extend("declaredReplacements", () =>
      listedUnder([{ declared: [{ name: "lerna" }] }], "declared"));

    it("comes back as they stand", ({ declaredReplacements }) => {
      expect(declaredReplacements).toStrictEqual([{ name: "lerna" }]);
    });
  });

  describe("entries written as anything but an object", () => {
    const it = test.extend("declaredReplacements", () =>
      listedUnder([{ declared: ["lerna", null, [], { name: "gulp" }] }], "declared"));

    it("leaves out everything that is not an object", ({ declaredReplacements }) => {
      expect(declaredReplacements).toStrictEqual([{ name: "gulp" }]);
    });
  });
});
