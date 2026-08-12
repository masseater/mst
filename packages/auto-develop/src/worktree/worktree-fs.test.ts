import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { LAST_USED_MARKER_NAME } from "./paths.ts";
import { createWorktreeFs } from "./worktree-fs.ts";

const it = test
  .extend("existenceChecks", () => {
    const baseDir = mkdtempSync(join(tmpdir(), "auto-develop-fs-"));
    const fs = createWorktreeFs();
    return { presentDir: fs.exists(baseDir), missingDir: fs.exists(join(baseDir, "missing")) };
  })
  .extend("markerWrite", () => {
    const worktreePath = mkdtempSync(join(tmpdir(), "auto-develop-fs-"));
    const fs = createWorktreeFs();
    fs.writeMarker(worktreePath, "2026-08-11T00:00:00.000Z");
    const markerPath = join(worktreePath, LAST_USED_MARKER_NAME);
    return {
      fileText: readFileSync(markerPath, "utf8"),
      readMtimeMs: fs.markerMtimeMs(worktreePath),
      statMtimeMs: statSync(markerPath).mtimeMs,
    };
  })
  .extend("missingMarkerMtime", () =>
    createWorktreeFs().markerMtimeMs(mkdtempSync(join(tmpdir(), "auto-develop-fs-"))),
  )
  .extend("invalidPathFailure", (): Error | null => {
    try {
      createWorktreeFs().exists(join("\0invalid", "path"));
      return null;
    } catch (statFailure) {
      return statFailure instanceof Error ? statFailure : null;
    }
  })
  .extend("existenceAfterRemoval", () => {
    const worktreePath = mkdtempSync(join(tmpdir(), "auto-develop-fs-"));
    const fs = createWorktreeFs();
    fs.removeRecursive(worktreePath);
    return fs.exists(worktreePath);
  });

describe("createWorktreeFs", () => {
  it("存在確認は実在するディレクトリを真にする", ({ existenceChecks }) => {
    expect(existenceChecks.presentDir).toStrictEqual(true);
  });

  it("存在確認は ENOENT を不在として返す", ({ existenceChecks }) => {
    expect(existenceChecks.missingDir).toStrictEqual(false);
  });

  it("マーカー書き込みは ISO 文字列と改行を書く", ({ markerWrite }) => {
    expect(markerWrite.fileText).toStrictEqual("2026-08-11T00:00:00.000Z\n");
  });

  it("書き込んだマーカーの mtime が読める", ({ markerWrite }) => {
    expect(markerWrite.readMtimeMs).toStrictEqual(markerWrite.statMtimeMs);
  });

  it("マーカーが無ければ mtime は null になる", ({ missingMarkerMtime }) => {
    expect(missingMarkerMtime).toStrictEqual(null);
  });

  it("ENOENT 以外の stat 失敗は例外として伝播する", ({ invalidPathFailure }) => {
    expect(invalidPathFailure?.message).toContain("null bytes");
  });

  it("再帰削除でディレクトリごと消える", ({ existenceAfterRemoval }) => {
    expect(existenceAfterRemoval).toStrictEqual(false);
  });
});
