import { describe, expect, test } from "vite-plus/test";

import { optionsRecord } from "./rule-options.ts";

describe("optionsRecord", () => {
  describe("a rule configured with a record", () => {
    const it = test.extend("record", () => optionsRecord([{ blockSpelling: "it" }]));

    it("hands the record over", ({ record }) => {
      expect(record).toStrictEqual({ blockSpelling: "it" });
    });
  });

  describe("a rule configured with nothing at all", () => {
    const it = test.extend("record", () => optionsRecord([]));

    it("hands no record over", ({ record }) => {
      expect(record).toBe(null);
    });
  });

  describe("a rule configured with a severity alone", () => {
    const it = test.extend("record", () => optionsRecord(["error"]));

    it("hands no record over", ({ record }) => {
      expect(record).toBe(null);
    });
  });

  describe("a rule configured with a list", () => {
    const it = test.extend("record", () => optionsRecord([["it"]]));

    it("hands no record over", ({ record }) => {
      expect(record).toBe(null);
    });
  });

  describe("a rule configured with a written-out absence", () => {
    const it = test.extend("record", () => optionsRecord([null]));

    it("hands no record over", ({ record }) => {
      expect(record).toBe(null);
    });
  });
});
