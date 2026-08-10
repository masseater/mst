import { describe, expect, test } from "vite-plus/test";

import { symbolPrefixedSegmentsOf } from "./symbol-prefixed-segments.ts";

const segmentsOf = ({
  filename,
  allowedNames = [],
}: {
  readonly filename: string;
  readonly allowedNames?: readonly string[];
}): readonly string[] =>
  symbolPrefixedSegmentsOf({ location: { cwd: "/repo", filename }, allowedNames }).map(
    (offending) => offending.segment,
  );

describe("symbolPrefixedSegmentsOf", () => {
  test("finds nothing on a path whose every name starts with a letter or a digit", () => {
    expect(segmentsOf({ filename: "/repo/packages/2024-report/src/index.ts" })).toEqual([]);
  });

  test("names the directory and the file that start with something else", () => {
    expect(segmentsOf({ filename: "/repo/packages/_draft/src/~scratch.ts" })).toEqual([
      "_draft",
      "~scratch.ts",
    ]);
  });

  test("names a repeated offending segment once", () => {
    expect(segmentsOf({ filename: "/repo/packages/_shared/_shared/index.ts" })).toEqual([
      "_shared",
    ]);
  });

  test("carries the path the offending segment was found on", () => {
    expect(
      symbolPrefixedSegmentsOf({
        location: { cwd: "/repo", filename: "/repo/packages/_draft/index.ts" },
        allowedNames: [],
      }),
    ).toEqual([{ segment: "_draft", path: "packages/_draft/index.ts" }]);
  });

  test("leaves out the names the caller allows", () => {
    expect(
      segmentsOf({ filename: "/repo/.config/tooling/setup.ts", allowedNames: [".config"] }),
    ).toEqual([]);
  });

  test("matches an allowed name given as a pattern", () => {
    expect(
      segmentsOf({ filename: "/repo/packages/.storybook/preview.ts", allowedNames: [".*book"] }),
    ).toEqual([]);
  });

  test("finds nothing outside the working directory", () => {
    expect(segmentsOf({ filename: "/elsewhere/_draft/index.ts" })).toEqual([]);
  });

  test("finds nothing for the working directory itself", () => {
    expect(segmentsOf({ filename: "/repo" })).toEqual([]);
  });
});
