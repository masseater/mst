import { describe, expect, test } from "vite-plus/test";

import {
  DEFAULT_SPAWN_FORMS,
  spawnFormMatching,
  spawnFormsIn,
  SPAWN_TARGET_LINE,
  SPAWN_TARGET_NAME,
} from "./spawn-forms.ts";

const OWN_FORM = {
  specifier: "@mst/utils",
  exported: "run",
  position: 1,
  carries: SPAWN_TARGET_NAME,
};

describe("spawnFormsIn", () => {
  describe("options nobody wrote", () => {
    const it = test.extend("forms", () =>
      spawnFormsIn({ options: [], standing: DEFAULT_SPAWN_FORMS }));

    it("leaves the standing table in place", ({ forms }) => {
      expect(forms).toStrictEqual(DEFAULT_SPAWN_FORMS);
    });
  });

  describe("a table the consumer writes", () => {
    const it = test.extend("forms", () =>
      spawnFormsIn({ options: [{ spawnForms: [OWN_FORM] }], standing: DEFAULT_SPAWN_FORMS }));

    it("stands in place of the one it replaces", ({ forms }) => {
      expect(forms).toStrictEqual([OWN_FORM]);
    });
  });

  describe("an entry written without a position", () => {
    const it = test.extend("forms", () =>
      spawnFormsIn({
        options: [
          {
            spawnForms: [{ specifier: "@mst/utils", exported: "run", carries: SPAWN_TARGET_LINE }],
          },
        ],
        standing: [],
      }));

    it("takes the first argument", ({ forms }) => {
      expect(forms).toStrictEqual([
        { specifier: "@mst/utils", exported: "run", position: 0, carries: SPAWN_TARGET_LINE },
      ]);
    });
  });

  describe("an entry written without a specifier", () => {
    const it = test.extend("forms", () =>
      spawnFormsIn({
        options: [{ spawnForms: [{ exported: "run", carries: SPAWN_TARGET_NAME }] }],
        standing: DEFAULT_SPAWN_FORMS,
      }));

    it("is left out", ({ forms }) => {
      expect(forms).toStrictEqual(DEFAULT_SPAWN_FORMS);
    });
  });

  describe("an entry written without an exported name", () => {
    const it = test.extend("forms", () =>
      spawnFormsIn({
        options: [{ spawnForms: [{ specifier: "@mst/utils", carries: SPAWN_TARGET_NAME }] }],
        standing: DEFAULT_SPAWN_FORMS,
      }));

    it("is left out", ({ forms }) => {
      expect(forms).toStrictEqual(DEFAULT_SPAWN_FORMS);
    });
  });

  describe("an entry saying nothing about what its argument carries", () => {
    const it = test.extend("forms", () =>
      spawnFormsIn({
        options: [{ spawnForms: [{ specifier: "@mst/utils", exported: "run", carries: "shell" }] }],
        standing: DEFAULT_SPAWN_FORMS,
      }));

    it("is left out", ({ forms }) => {
      expect(forms).toStrictEqual(DEFAULT_SPAWN_FORMS);
    });
  });
});

describe("spawnFormMatching", () => {
  describe("a runtime module named without its prefix", () => {
    const it = test.extend("form", () =>
      spawnFormMatching({
        forms: DEFAULT_SPAWN_FORMS,
        specifier: "child_process",
        exported: "execSync",
      }));

    it("reaches the entry named with the prefix", ({ form }) => {
      expect(form).toStrictEqual({
        specifier: "node:child_process",
        exported: "execSync",
        position: 0,
        carries: SPAWN_TARGET_LINE,
      });
    });
  });

  describe("a module the table says nothing about", () => {
    const it = test.extend("form", () =>
      spawnFormMatching({
        forms: DEFAULT_SPAWN_FORMS,
        specifier: "node:fs",
        exported: "readFile",
      }));

    it("reaches no entry", ({ form }) => {
      expect(form).toBe(null);
    });
  });
});
