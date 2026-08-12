import { describe, expect, test } from "vite-plus/test";

import { requiredFilesFrom } from "./required-file-entries.ts";

const REASON = "the release job reads it";

const it = test
  .extend("filesOfEmptyOptions", () => requiredFilesFrom([]))
  .extend("filesOfOptionsWithoutRegistration", () => requiredFilesFrom([{}]))
  .extend("filesOfOwnerlessRow", () =>
    requiredFilesFrom([{ requiredFiles: [{ pattern: "CHANGELOG.md", reason: REASON }] }]),
  )
  .extend("filesOfFullyDescribedRow", () =>
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
    ]),
  )
  .extend("filesOfPathlessRow", () =>
    requiredFilesFrom([{ requiredFiles: [{ pattern: "", reason: REASON }] }]),
  )
  .extend("filesOfReasonlessRow", () =>
    requiredFilesFrom([{ requiredFiles: [{ pattern: "CHANGELOG.md", reason: "" }] }]),
  )
  .extend("filesOfUnspelledOwnerRow", () =>
    requiredFilesFrom([{ requiredFiles: [{ pattern: "CHANGELOG.md", owner: 5, reason: REASON }] }]),
  );

describe("required-file-entries", () => {
  it("options that carry nothing at all hold no rows", ({ filesOfEmptyOptions }) => {
    expect(filesOfEmptyOptions).toStrictEqual([]);
  });

  it("an options object that registers nothing holds no rows", ({
    filesOfOptionsWithoutRegistration,
  }) => {
    expect(filesOfOptionsWithoutRegistration).toStrictEqual([]);
  });

  it("a row without an owner is registered against the repository itself", ({
    filesOfOwnerlessRow,
  }) => {
    expect(filesOfOwnerlessRow).toStrictEqual([
      { pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] },
    ]);
  });

  it("a row carries the owner, the reason and the checks that read the file", ({
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

  it("a row that names no path asks for nothing and is dropped", ({ filesOfPathlessRow }) => {
    expect(filesOfPathlessRow).toStrictEqual([]);
  });

  it("a row that carries no reason is not a registration and is dropped", ({
    filesOfReasonlessRow,
  }) => {
    expect(filesOfReasonlessRow).toStrictEqual([]);
  });

  it("an owner that is not spelled out leaves the row against the repository itself", ({
    filesOfUnspelledOwnerRow,
  }) => {
    expect(filesOfUnspelledOwnerRow).toStrictEqual([
      { pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] },
    ]);
  });
});
