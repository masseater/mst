import { describe, expect, test } from "vite-plus/test";

import { requiredFilesFrom } from "./required-file-entries.ts";

const REASON = "the release job reads it";

describe("requiredFilesFrom", () => {
  describe("options that carry nothing at all", () => {
    const it = test.extend("filesOfEmptyOptions", () => requiredFilesFrom([]));

    it("hold no rows", ({ filesOfEmptyOptions }) => {
      expect(filesOfEmptyOptions).toStrictEqual([]);
    });
  });

  describe("an options object that registers nothing", () => {
    const it = test.extend("filesOfOptionsWithoutRegistration", () => requiredFilesFrom([{}]));

    it("holds no rows", ({ filesOfOptionsWithoutRegistration }) => {
      expect(filesOfOptionsWithoutRegistration).toStrictEqual([]);
    });
  });

  describe("a row without an owner", () => {
    const it = test.extend("filesOfOwnerlessRow", () =>
      requiredFilesFrom([{ requiredFiles: [{ pattern: "CHANGELOG.md", reason: REASON }] }]));

    it("is registered against the repository itself", ({ filesOfOwnerlessRow }) => {
      expect(filesOfOwnerlessRow).toStrictEqual([
        { pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] },
      ]);
    });
  });

  describe("a row that spells out everything it can", () => {
    const it = test.extend("filesOfFullyDescribedRow", () =>
      requiredFilesFrom([
        {
          requiredFiles: [
            {
              pattern: "README.md",
              owner: "packages/*",
              reason: REASON,
              contentChecks: ["require-readme-sections", 7],
            },
          ],
        },
      ]));

    it("carries the owner, the reason and the checks that read the file", ({
      filesOfFullyDescribedRow,
    }) => {
      expect(filesOfFullyDescribedRow).toStrictEqual([
        {
          pattern: "README.md",
          owner: "packages/*",
          reason: REASON,
          contentChecks: ["require-readme-sections"],
        },
      ]);
    });
  });

  describe("a row that names no path", () => {
    const it = test.extend("filesOfPathlessRow", () =>
      requiredFilesFrom([{ requiredFiles: [{ pattern: "", reason: REASON }] }]));

    it("asks for nothing and is dropped", ({ filesOfPathlessRow }) => {
      expect(filesOfPathlessRow).toStrictEqual([]);
    });
  });

  describe("a row that carries no reason", () => {
    const it = test.extend("filesOfReasonlessRow", () =>
      requiredFilesFrom([{ requiredFiles: [{ pattern: "CHANGELOG.md", reason: "" }] }]));

    it("is not a registration and is dropped", ({ filesOfReasonlessRow }) => {
      expect(filesOfReasonlessRow).toStrictEqual([]);
    });
  });

  describe("an owner that is not spelled out", () => {
    const it = test.extend("filesOfUnspelledOwnerRow", () =>
      requiredFilesFrom([
        { requiredFiles: [{ pattern: "CHANGELOG.md", owner: 5, reason: REASON }] },
      ]));

    it("leaves the row against the repository itself", ({ filesOfUnspelledOwnerRow }) => {
      expect(filesOfUnspelledOwnerRow).toStrictEqual([
        { pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] },
      ]);
    });
  });
});
