import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { textOrNull } from "./read-text.ts";

describe("textOrNull", () => {
  describe("a file that exists", () => {
    const it = test.extend("presentFileText", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-text-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "present.txt"), "written", "utf8");
      return textOrNull(join(root, "present.txt"));
    });

    it("hands back its text", ({ presentFileText }) => {
      expect(presentFileText).toBe("written");
    });
  });

  describe("a file that does not exist", () => {
    const it = test.extend("missingFileText", () =>
      textOrNull(join(tmpdir(), "read-text-absent", "missing.txt")));

    it("is an absence", ({ missingFileText }) => {
      expect(missingFileText).toBe(null);
    });
  });
});
