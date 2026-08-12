import { describe, expect, test } from "vite-plus/test";

import { symbolPrefixedSegmentsOf } from "./symbol-prefixed-segments.ts";

const it = test
  .extend("alphanumericPathFindings", () =>
    symbolPrefixedSegmentsOf({
      location: { cwd: "/repo", filename: "/repo/packages/2024-report/src/index.ts" },
      allowedNames: [],
    }))
  .extend("symbolPrefixedPathFindings", () =>
    symbolPrefixedSegmentsOf({
      location: { cwd: "/repo", filename: "/repo/packages/_draft/src/~scratch.ts" },
      allowedNames: [],
    }),
  )
  .extend("repeatedSegmentFindings", () =>
    symbolPrefixedSegmentsOf({
      location: { cwd: "/repo", filename: "/repo/packages/_shared/_shared/index.ts" },
      allowedNames: [],
    }),
  )
  .extend("draftDirectoryFindings", () =>
    symbolPrefixedSegmentsOf({
      location: { cwd: "/repo", filename: "/repo/packages/_draft/index.ts" },
      allowedNames: [],
    }),
  )
  .extend("allowedNameFindings", () =>
    symbolPrefixedSegmentsOf({
      location: { cwd: "/repo", filename: "/repo/.config/tooling/setup.ts" },
      allowedNames: [".config"],
    }),
  )
  .extend("allowedPatternFindings", () =>
    symbolPrefixedSegmentsOf({
      location: { cwd: "/repo", filename: "/repo/packages/.storybook/preview.ts" },
      allowedNames: [".*book"],
    }),
  )
  .extend("outsideWorkingDirectoryFindings", () =>
    symbolPrefixedSegmentsOf({
      location: { cwd: "/repo", filename: "/elsewhere/_draft/index.ts" },
      allowedNames: [],
    }),
  )
  .extend("workingDirectoryFindings", () =>
    symbolPrefixedSegmentsOf({
      location: { cwd: "/repo", filename: "/repo" },
      allowedNames: [],
    }),
  );

describe("symbolPrefixedSegmentsOf", () => {
  it("finds nothing on a path whose every name starts with a letter or a digit", ({
    alphanumericPathFindings,
  }) => {
    expect(alphanumericPathFindings).toStrictEqual(new Map());
  });

  it("names the directory and the file that start with something else", ({
    symbolPrefixedPathFindings,
  }) => {
    expect(symbolPrefixedPathFindings).toStrictEqual(
      new Map([
        ["_draft", "packages/_draft/src/~scratch.ts"],
        ["~scratch.ts", "packages/_draft/src/~scratch.ts"],
      ]),
    );
  });

  it("names a repeated offending segment once", ({ repeatedSegmentFindings }) => {
    expect(repeatedSegmentFindings).toStrictEqual(
      new Map([["_shared", "packages/_shared/_shared/index.ts"]]),
    );
  });

  it("carries the path the offending segment was found on", ({ draftDirectoryFindings }) => {
    expect(draftDirectoryFindings).toStrictEqual(new Map([["_draft", "packages/_draft/index.ts"]]));
  });

  it("leaves out the names the caller allows", ({ allowedNameFindings }) => {
    expect(allowedNameFindings).toStrictEqual(new Map());
  });

  it("matches an allowed name given as a pattern", ({ allowedPatternFindings }) => {
    expect(allowedPatternFindings).toStrictEqual(new Map());
  });

  it("finds nothing outside the working directory", ({ outsideWorkingDirectoryFindings }) => {
    expect(outsideWorkingDirectoryFindings).toStrictEqual(new Map());
  });

  it("finds nothing for the working directory itself", ({ workingDirectoryFindings }) => {
    expect(workingDirectoryFindings).toStrictEqual(new Map());
  });
});
