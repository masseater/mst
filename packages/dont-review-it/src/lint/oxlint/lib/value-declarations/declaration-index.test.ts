import { describe, expect, test } from "vite-plus/test";

import {
  buildValueDeclarationIndex,
  duplicateValueReportsIn,
  type IndexedValueFile,
} from "./declaration-index.ts";

import type { ValueDeclaration } from "./declarations.ts";

const AUTHORITY_PATH = "packages/one/src/read.ts";

const COPY_PATH = "packages/two/src/read.ts";

const EXPORTED_SEED: ValueDeclaration = {
  name: "seed",
  line: 3,
  exported: true,
  fingerprint: "one",
};

const fileWith = (
  relativePath: string,
  declarations: readonly ValueDeclaration[],
): IndexedValueFile => ({ relativePath, declarations });

const reportedNamesIn = (input: {
  readonly files: readonly IndexedValueFile[];
  readonly relativePath: string;
}): readonly string[] =>
  duplicateValueReportsIn({
    index: buildValueDeclarationIndex(input.files),
    relativePath: input.relativePath,
  }).map((report) => `${report.site.name}:${report.site.line}`);

const matchedSitesIn = (files: readonly IndexedValueFile[]): readonly string[] =>
  duplicateValueReportsIn({
    index: buildValueDeclarationIndex(files),
    relativePath: AUTHORITY_PATH,
  }).flatMap((report) => report.matches.map((match) => `${match.relativePath}:${match.line}`));

describe("duplicateValueReportsIn", () => {
  test("reports a declaration another file spells with the same name and body", () => {
    expect(
      reportedNamesIn({
        files: [
          fileWith(AUTHORITY_PATH, [EXPORTED_SEED]),
          fileWith(COPY_PATH, [{ ...EXPORTED_SEED, line: 8 }]),
        ],
        relativePath: COPY_PATH,
      }),
    ).toStrictEqual(["seed:8"]);
  });

  test("reports a declaration standing twice in one file", () => {
    expect(
      reportedNamesIn({
        files: [fileWith(AUTHORITY_PATH, [EXPORTED_SEED, { ...EXPORTED_SEED, line: 9 }])],
        relativePath: AUTHORITY_PATH,
      }),
    ).toStrictEqual(["seed:3", "seed:9"]);
  });

  test("leaves a pair alone when neither of the two is exported", () => {
    expect(
      reportedNamesIn({
        files: [
          fileWith(AUTHORITY_PATH, [{ ...EXPORTED_SEED, exported: false }]),
          fileWith(COPY_PATH, [{ ...EXPORTED_SEED, exported: false, line: 8 }]),
        ],
        relativePath: COPY_PATH,
      }),
    ).toStrictEqual([]);
  });

  test("reports a local declaration that stands against an exported one", () => {
    expect(
      reportedNamesIn({
        files: [
          fileWith(AUTHORITY_PATH, [EXPORTED_SEED]),
          fileWith(COPY_PATH, [{ ...EXPORTED_SEED, exported: false, line: 8 }]),
        ],
        relativePath: COPY_PATH,
      }),
    ).toStrictEqual(["seed:8"]);
  });

  test("leaves a pair alone when the two bodies are spelled differently", () => {
    expect(
      reportedNamesIn({
        files: [
          fileWith(AUTHORITY_PATH, [EXPORTED_SEED]),
          fileWith(COPY_PATH, [{ ...EXPORTED_SEED, fingerprint: "two", line: 8 }]),
        ],
        relativePath: COPY_PATH,
      }),
    ).toStrictEqual([]);
  });

  test("leaves a pair alone when the two names are spelled differently", () => {
    expect(
      reportedNamesIn({
        files: [
          fileWith(AUTHORITY_PATH, [EXPORTED_SEED]),
          fileWith(COPY_PATH, [{ ...EXPORTED_SEED, name: "kept", line: 8 }]),
        ],
        relativePath: COPY_PATH,
      }),
    ).toStrictEqual([]);
  });

  test("leaves a declaration the index lists no namesake for alone", () => {
    expect(
      duplicateValueReportsIn({
        index: {
          sitesByName: new Map(),
          sitesByPath: new Map([
            [AUTHORITY_PATH, [{ ...EXPORTED_SEED, relativePath: AUTHORITY_PATH }]],
          ]),
        },
        relativePath: AUTHORITY_PATH,
      }),
    ).toStrictEqual([]);
  });

  test("leaves a file the index never saw alone", () => {
    expect(
      reportedNamesIn({
        files: [fileWith(AUTHORITY_PATH, [EXPORTED_SEED])],
        relativePath: "packages/three/src/read.ts",
      }),
    ).toStrictEqual([]);
  });

  test("hands back the other places the name stands, in reading order", () => {
    expect(
      matchedSitesIn([
        fileWith(AUTHORITY_PATH, [EXPORTED_SEED]),
        fileWith(COPY_PATH, [
          { ...EXPORTED_SEED, line: 12 },
          { ...EXPORTED_SEED, line: 8 },
        ]),
      ]),
    ).toStrictEqual([`${COPY_PATH}:8`, `${COPY_PATH}:12`]);
  });
});
