import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { LAST_USED_MARKER_NAME } from "./paths.ts";
import { createWorktreeFs } from "./worktree-fs.ts";

describe("createWorktreeFs", () => {
  test("存在確認は ENOENT を不在として返し実在を真にする", () => {
    const baseDir = mkdtempSync(join(tmpdir(), "auto-develop-fs-"));
    const fs = createWorktreeFs();
    expect([fs.exists(baseDir), fs.exists(join(baseDir, "missing"))]).toStrictEqual([true, false]);
  });

  test("マーカー書き込みは ISO 文字列と改行を書き mtime が読める", () => {
    const worktreePath = mkdtempSync(join(tmpdir(), "auto-develop-fs-"));
    const fs = createWorktreeFs();
    fs.writeMarker(worktreePath, "2026-08-11T00:00:00.000Z");
    const markerPath = join(worktreePath, LAST_USED_MARKER_NAME);
    expect([readFileSync(markerPath, "utf8"), fs.markerMtimeMs(worktreePath)]).toStrictEqual([
      "2026-08-11T00:00:00.000Z\n",
      statSync(markerPath).mtimeMs,
    ]);
  });

  test("マーカーが無ければ mtime は null になる", () => {
    const worktreePath = mkdtempSync(join(tmpdir(), "auto-develop-fs-"));
    expect(createWorktreeFs().markerMtimeMs(worktreePath)).toStrictEqual(null);
  });

  test("ENOENT 以外の stat 失敗は例外として伝播する", () => {
    const fs = createWorktreeFs();
    const brokenPath = join("\0invalid", "path");
    expect(() => fs.exists(brokenPath)).toThrow("null bytes");
  });

  test("再帰削除でディレクトリごと消える", () => {
    const worktreePath = mkdtempSync(join(tmpdir(), "auto-develop-fs-"));
    const fs = createWorktreeFs();
    fs.removeRecursive(worktreePath);
    expect(fs.exists(worktreePath)).toStrictEqual(false);
  });
});
