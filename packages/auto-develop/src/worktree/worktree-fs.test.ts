import { mkdtempSync, readFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { LAST_USED_MARKER_NAME } from "./paths.ts";
import { createWorktreeFs } from "./worktree-fs.ts";

describe("createWorktreeFs", () => {
  const it = test
    .extend("existingDirPresence", () =>
      createWorktreeFs().exists(mkdtempSync(join(tmpdir(), "auto-develop-fs-"))))
    .extend("missingDirPresence", () =>
      createWorktreeFs().exists(join(mkdtempSync(join(tmpdir(), "auto-develop-fs-")), "missing")),
    )
    .extend("markerFileText", () => {
      const worktreePath = mkdtempSync(join(tmpdir(), "auto-develop-fs-"));
      createWorktreeFs().writeMarker(worktreePath, "2026-08-11T00:00:00.000Z");
      return readFileSync(join(worktreePath, LAST_USED_MARKER_NAME), "utf8");
    })
    .extend("pinnedMarkerMtimeMs", () => {
      const worktreePath = mkdtempSync(join(tmpdir(), "auto-develop-fs-"));
      const worktreeFs = createWorktreeFs();
      worktreeFs.writeMarker(worktreePath, "2026-08-11T00:00:00.000Z");
      const pinnedMarkerTime = new Date(1_770_000_000_000);
      utimesSync(join(worktreePath, LAST_USED_MARKER_NAME), pinnedMarkerTime, pinnedMarkerTime);
      return worktreeFs.markerMtimeMs(worktreePath);
    })
    .extend("missingMarkerMtimeMs", () =>
      createWorktreeFs().markerMtimeMs(mkdtempSync(join(tmpdir(), "auto-develop-fs-"))),
    )
    .extend("nullBytePathFailureName", () => {
      try {
        return String(createWorktreeFs().exists(join("\0invalid", "path")));
      } catch (statFailure) {
        return statFailure instanceof Error ? statFailure.name : String(statFailure);
      }
    })
    .extend("removedWorktreePresence", () => {
      const worktreePath = mkdtempSync(join(tmpdir(), "auto-develop-fs-"));
      const worktreeFs = createWorktreeFs();
      worktreeFs.removeRecursive(worktreePath);
      return worktreeFs.exists(worktreePath);
    });

  it("存在確認は実在するディレクトリを真にする", ({ existingDirPresence }) => {
    expect(existingDirPresence).toBe(true);
  });

  it("存在確認は ENOENT を不在として返す", ({ missingDirPresence }) => {
    expect(missingDirPresence).toBe(false);
  });

  it("マーカー書き込みは ISO 文字列と改行を書く", ({ markerFileText }) => {
    expect(markerFileText).toBe("2026-08-11T00:00:00.000Z\n");
  });

  it("書き込んだマーカーの mtime が読める", ({ pinnedMarkerMtimeMs }) => {
    expect(pinnedMarkerMtimeMs).toBe(1_770_000_000_000);
  });

  it("マーカーが無ければ mtime は null になる", ({ missingMarkerMtimeMs }) => {
    expect(missingMarkerMtimeMs).toBe(null);
  });

  it("ENOENT 以外の stat 失敗は例外として伝播する", ({ nullBytePathFailureName }) => {
    expect(nullBytePathFailureName).toBe("TypeError");
  });

  it("再帰削除でディレクトリごと消える", ({ removedWorktreePresence }) => {
    expect(removedWorktreePresence).toBe(false);
  });
});
