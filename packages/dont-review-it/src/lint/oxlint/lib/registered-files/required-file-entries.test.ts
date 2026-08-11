import { describe, expect, test } from "vite-plus/test";

import { requiredFilesFrom } from "./required-file-entries.ts";

const REASON = "the release job reads it";

describe("required-file-entries", () => {
  test("options that register nothing hold no rows", () => {
    expect(requiredFilesFrom([])).toStrictEqual([]);
    expect(requiredFilesFrom([{}])).toStrictEqual([]);
  });

  test("a row without an owner is registered against the repository itself", () => {
    expect(
      requiredFilesFrom([{ requiredFiles: [{ pattern: "CHANGELOG.md", reason: REASON }] }]),
    ).toStrictEqual([{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }]);
  });

  test("a row carries the owner, the reason and the checks that read the file", () => {
    expect(
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
    ).toStrictEqual([
      {
        pattern: "README.md",
        owner: "packages/*",
        reason: REASON,
        contentChecks: ["require-readme-sections"],
      },
    ]);
  });

  test("a row that names no path asks for nothing and is dropped", () => {
    expect(requiredFilesFrom([{ requiredFiles: [{ pattern: "", reason: REASON }] }])).toStrictEqual(
      [],
    );
  });

  test("a row that carries no reason is not a registration and is dropped", () => {
    expect(
      requiredFilesFrom([{ requiredFiles: [{ pattern: "CHANGELOG.md", reason: "" }] }]),
    ).toStrictEqual([]);
  });

  test("an owner that is not spelled out leaves the row against the repository itself", () => {
    expect(
      requiredFilesFrom([
        { requiredFiles: [{ pattern: "CHANGELOG.md", owner: 5, reason: REASON }] },
      ]),
    ).toStrictEqual([{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }]);
  });
});
