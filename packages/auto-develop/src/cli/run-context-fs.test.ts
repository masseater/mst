import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { runContextFsOnDisk } from "./run-context-fs.ts";

describe("runContextFsOnDisk", () => {
  test("creates nested directories and writes formatted JSON with a final newline", () => {
    const root = mkdtempSync(join(tmpdir(), "auto-develop-run-context-fs-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const directory = join(root, "nested", "context");
    const path = join(directory, "run-context.json");

    runContextFsOnDisk.mkdirRecursive(directory);
    runContextFsOnDisk.writeJson(path, { mode: "reviewer", prNumber: 17 });

    expect(readFileSync(path, "utf8")).toBe('{\n  "mode": "reviewer",\n  "prNumber": 17\n}\n');
  });
});
