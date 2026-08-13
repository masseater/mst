import { describe, expect, test } from "vite-plus/test";

import { recordOf, stringEntriesOf } from "./record-fields.ts";

describe("recordOf", () => {
  describe("a plain object", () => {
    const it = test.extend("record", () => recordOf({ name: "left" }));

    it("passes through", ({ record }) => {
      expect(record).toStrictEqual({ name: "left" });
    });
  });

  describe("nothing", () => {
    const it = test.extend("record", () => recordOf(null));

    it("turns into an empty record", ({ record }) => {
      expect(record).toStrictEqual({});
    });
  });

  describe("a list", () => {
    const it = test.extend("record", () => recordOf(["name"]));

    it("turns into an empty record", ({ record }) => {
      expect(record).toStrictEqual({});
    });
  });

  describe("a scalar", () => {
    const it = test.extend("record", () => recordOf("name"));

    it("turns into an empty record", ({ record }) => {
      expect(record).toStrictEqual({});
    });
  });
});

describe("stringEntriesOf", () => {
  describe("a record holding a nested value beside a specifier", () => {
    const it = test.extend("entries", () =>
      stringEntriesOf({ kept: "^1.0.0", dropped: { nested: true } }));

    it("keeps the entries whose declared specifier is a string", ({ entries }) => {
      expect(entries).toStrictEqual([["kept", "^1.0.0"]]);
    });
  });

  describe("something that is not a record", () => {
    const it = test.extend("entries", () => stringEntriesOf(undefined));

    it("reads as no entries", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });
});
