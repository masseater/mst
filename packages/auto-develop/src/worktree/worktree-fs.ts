import { rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { LAST_USED_MARKER_NAME } from "./paths.ts";

export type WorktreeFs = {
  readonly exists: (path: string) => boolean;
  readonly removeRecursive: (path: string) => void;
  readonly writeMarker: (worktreePath: string, isoTime: string) => void;
  readonly markerMtimeMs: (worktreePath: string) => number | null;
};

export const createWorktreeFs = (): WorktreeFs => ({
  exists: (path) => {
    try {
      statSync(path);
      return true;
    } catch (statFailure) {
      if (statFailure instanceof Error && "code" in statFailure && statFailure.code === "ENOENT") {
        return false;
      }
      throw statFailure;
    }
  },
  removeRecursive: (path) => {
    rmSync(path, { recursive: true, force: true });
  },
  writeMarker: (worktreePath, isoTime) => {
    writeFileSync(join(worktreePath, LAST_USED_MARKER_NAME), `${isoTime}\n`);
  },
  markerMtimeMs: (worktreePath) => {
    try {
      return statSync(join(worktreePath, LAST_USED_MARKER_NAME)).mtimeMs;
    } catch (statFailure) {
      void statFailure;
      return null;
    }
  },
});
