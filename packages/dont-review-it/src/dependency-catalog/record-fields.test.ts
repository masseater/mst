import { describe, expect, test } from "vite-plus/test";

import { recordOf, stringEntriesOf } from "./record-fields.ts";

describe("recordOf", () => {
  describe("a plain object", () => {
    const it = test.extend("dependencyFields", () => recordOf({ name: "left" }));

    it("passes through", ({ dependencyFields }) => {
      expect(dependencyFields).toStrictEqual({ name: "left" });
    });
  });

  describe("nothing", () => {
    const it = test.extend("dependencyFields", () => recordOf(null));

    it("turns into an empty record", ({ dependencyFields }) => {
      expect(dependencyFields).toStrictEqual({});
    });
  });

  describe("a list", () => {
    const it = test.extend("dependencyFields", () => recordOf(["name"]));

    it("turns into an empty record", ({ dependencyFields }) => {
      expect(dependencyFields).toStrictEqual({});
    });
  });

  describe("a scalar", () => {
    const it = test.extend("dependencyFields", () => recordOf("name"));

    it("turns into an empty record", ({ dependencyFields }) => {
      expect(dependencyFields).toStrictEqual({});
    });
  });
});

describe("stringEntriesOf", () => {
  describe("a record holding a nested value beside a specifier", () => {
    const it = test.extend("specifierPairs", () =>
      stringEntriesOf({ kept: "^1.0.0", dropped: { nested: true } }));

    it("keeps the entries whose declared specifier is a string", ({ specifierPairs }) => {
      expect(specifierPairs).toStrictEqual([["kept", "^1.0.0"]]);
    });
  });

  describe("something that is not a record", () => {
    const it = test.extend("specifierPairs", () => stringEntriesOf(undefined));

    it("reads as no entries", ({ specifierPairs }) => {
      expect(specifierPairs).toStrictEqual([]);
    });
  });
});
