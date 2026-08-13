import { describe, expect, test } from "vite-plus/test";

import { optionsRecord } from "./rule-options.ts";

describe("optionsRecord", () => {
  describe("a rule configured with a record", () => {
    const it = test.extend("optionsRecordOfConfiguredRecord", () =>
      optionsRecord([{ blockSpelling: "it" }]));

    it("hands the record over", ({ optionsRecordOfConfiguredRecord }) => {
      expect(optionsRecordOfConfiguredRecord).toStrictEqual({ blockSpelling: "it" });
    });
  });

  describe("a rule configured with nothing at all", () => {
    const it = test.extend("optionsRecordOfNothingConfigured", () => optionsRecord([]));

    it("hands no record over", ({ optionsRecordOfNothingConfigured }) => {
      expect(optionsRecordOfNothingConfigured).toBe(null);
    });
  });

  describe("a rule configured with a severity alone", () => {
    const it = test.extend("optionsRecordOfSeverityAlone", () => optionsRecord(["error"]));

    it("hands no record over", ({ optionsRecordOfSeverityAlone }) => {
      expect(optionsRecordOfSeverityAlone).toBe(null);
    });
  });

  describe("a rule configured with a list", () => {
    const it = test.extend("optionsRecordOfConfiguredList", () => optionsRecord([["it"]]));

    it("hands no record over", ({ optionsRecordOfConfiguredList }) => {
      expect(optionsRecordOfConfiguredList).toBe(null);
    });
  });

  describe("a rule configured with a written-out absence", () => {
    const it = test.extend("optionsRecordOfWrittenOutAbsence", () => optionsRecord([null]));

    it("hands no record over", ({ optionsRecordOfWrittenOutAbsence }) => {
      expect(optionsRecordOfWrittenOutAbsence).toBe(null);
    });
  });
});
