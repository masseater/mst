import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { runContextFsOnDisk } from "./run-context-fs.ts";

describe("runContextFsOnDisk", () => {
  const it = test.extend("writtenRunContext", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "auto-develop-run-context-fs-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const directory = join(root, "nested", "context");
    const path = join(directory, "run-context.json");
    runContextFsOnDisk.mkdirRecursive(directory);
    runContextFsOnDisk.writeJson(path, { mode: "reviewer", prNumber: 17 });
    return readFileSync(path, "utf8");
  });

  it("creates nested directories and writes formatted JSON with a final newline", ({
    writtenRunContext,
  }) => {
    expect(writtenRunContext).toBe('{\n  "mode": "reviewer",\n  "prNumber": 17\n}\n');
  });
});
