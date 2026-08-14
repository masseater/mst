import { mkdirSync, writeFileSync } from "node:fs";

import type { RunContextFs } from "../context/prepare-run-context.ts";

export const runContextFsOnDisk: RunContextFs = {
  mkdirRecursive: (dir) => {
    mkdirSync(dir, { recursive: true });
  },
  writeJson: (path, value) => {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  },
};
