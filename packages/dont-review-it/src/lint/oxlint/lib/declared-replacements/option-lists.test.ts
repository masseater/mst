import { describe, expect, test } from "vite-plus/test";

import { listedUnder } from "./option-lists.ts";

describe("listedUnder", () => {
  describe("options nobody wrote", () => {
    const it = test.extend("entries", () => listedUnder([], "declared"));

    it("carries no entries", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("an option written as something other than an object", () => {
    const it = test.extend("entries", () => listedUnder(["declared"], "declared"));

    it("carries no entries", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("an option written as nothing", () => {
    const it = test.extend("entries", () => listedUnder([null], "declared"));

    it("carries no entries", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("an option written as a list", () => {
    const it = test.extend("entries", () => listedUnder([[]], "declared"));

    it("carries no entries under a key", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("a key written as something other than a list", () => {
    const it = test.extend("entries", () => listedUnder([{ declared: "lerna" }], "declared"));

    it("carries no entries", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("a key nobody wrote", () => {
    const it = test.extend("entries", () => listedUnder([{ withdrawn: [] }], "declared"));

    it("carries no entries", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("entries written as objects", () => {
    const it = test.extend("entries", () =>
      listedUnder([{ declared: [{ name: "lerna" }] }], "declared"));

    it("comes back as they stand", ({ entries }) => {
      expect(entries).toStrictEqual([{ name: "lerna" }]);
    });
  });

  describe("entries written as anything but an object", () => {
    const it = test.extend("entries", () =>
      listedUnder([{ declared: ["lerna", null, [], { name: "gulp" }] }], "declared"));

    it("leaves out everything that is not an object", ({ entries }) => {
      expect(entries).toStrictEqual([{ name: "gulp" }]);
    });
  });
});
