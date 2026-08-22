import { describe, expect, test } from "vite-plus/test";

import { symbolPrefixedSegmentsOf } from "./symbol-prefixed-segments.ts";

describe("symbolPrefixedSegmentsOf", () => {
  describe("a path whose every name starts with a letter or a digit", () => {
    const it = test.extend("findings", () =>
      symbolPrefixedSegmentsOf({
        location: { cwd: "/repo", filename: "/repo/packages/2024-report/src/index.ts" },
        allowedNames: [],
      }));

    it("finds nothing", ({ findings }) => {
      expect(findings).toStrictEqual(new Map());
    });
  });

  describe("a path carrying a directory and a file that start with something else", () => {
    const it = test.extend("findings", () =>
      symbolPrefixedSegmentsOf({
        location: { cwd: "/repo", filename: "/repo/packages/_draft/src/~scratch.ts" },
        allowedNames: [],
      }));

    it("names both of them against the path they were found on", ({ findings }) => {
      expect(findings).toStrictEqual(
        new Map([
          ["_draft", "packages/_draft/src/~scratch.ts"],
          ["~scratch.ts", "packages/_draft/src/~scratch.ts"],
        ]),
      );
    });
  });

  describe("a path carrying the same offending segment twice", () => {
    const it = test.extend("findings", () =>
      symbolPrefixedSegmentsOf({
        location: { cwd: "/repo", filename: "/repo/packages/_shared/_shared/index.ts" },
        allowedNames: [],
      }));

    it("names it once", ({ findings }) => {
      expect(findings).toStrictEqual(new Map([["_shared", "packages/_shared/_shared/index.ts"]]));
    });
  });

  describe("a path carrying one offending directory", () => {
    const it = test.extend("findings", () =>
      symbolPrefixedSegmentsOf({
        location: { cwd: "/repo", filename: "/repo/packages/_draft/index.ts" },
        allowedNames: [],
      }));

    it("carries the path the offending segment was found on", ({ findings }) => {
      expect(findings).toStrictEqual(new Map([["_draft", "packages/_draft/index.ts"]]));
    });
  });

  describe("a path whose offending segment is a name the caller allows", () => {
    const it = test.extend("findings", () =>
      symbolPrefixedSegmentsOf({
        location: { cwd: "/repo", filename: "/repo/.config/tooling/setup.ts" },
        allowedNames: [".config"],
      }));

    it("leaves that name out", ({ findings }) => {
      expect(findings).toStrictEqual(new Map());
    });
  });

  describe("a path whose offending segment matches an allowed name given as a pattern", () => {
    const it = test.extend("findings", () =>
      symbolPrefixedSegmentsOf({
        location: { cwd: "/repo", filename: "/repo/packages/.storybook/preview.ts" },
        allowedNames: [".*book"],
      }));

    it("leaves that name out too", ({ findings }) => {
      expect(findings).toStrictEqual(new Map());
    });
  });

  describe("a path that lies outside the working directory", () => {
    const it = test.extend("findings", () =>
      symbolPrefixedSegmentsOf({
        location: { cwd: "/repo", filename: "/elsewhere/_draft/index.ts" },
        allowedNames: [],
      }));

    it("finds nothing on it", ({ findings }) => {
      expect(findings).toStrictEqual(new Map());
    });
  });

  describe("the working directory itself", () => {
    const it = test.extend("findings", () =>
      symbolPrefixedSegmentsOf({
        location: { cwd: "/repo", filename: "/repo" },
        allowedNames: [],
      }));

    it("finds nothing on it", ({ findings }) => {
      expect(findings).toStrictEqual(new Map());
    });
  });
});
