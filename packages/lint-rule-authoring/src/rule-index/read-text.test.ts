import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { textOrNull } from "./read-text.ts";

describe("textOrNull", () => {
  test("a file that exists hands back its text", () => {
    const root = mkdtempSync(join(tmpdir(), "read-text-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "present.txt"), "written", "utf8");

    expect(textOrNull(join(root, "present.txt"))).toBe("written");
  });

  test("a file that does not exist is an absence", () => {
    expect(textOrNull(join(tmpdir(), "read-text-absent", "missing.txt"))).toBe(null);
  });
});
