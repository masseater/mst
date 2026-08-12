import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { readEnvVar } from "../config/env.ts";
import { resolveRepositoryRoot } from "../config/repository-root.ts";

import type { Logger } from "../logging/logger.ts";

const QUEUE_SNAPSHOT_ENV_VAR = "AUTO_DEVELOP_QUEUE_PATH";

export const resolveSnapshotPath = (resolution: {
  readonly explicitPath: string | undefined;
  readonly env?: Readonly<Record<string, unknown>>;
}): string => {
  if (resolution.explicitPath !== undefined && resolution.explicitPath !== "") {
    return resolution.explicitPath;
  }
  const envPath = readEnvVar(QUEUE_SNAPSHOT_ENV_VAR, resolution.env ?? process.env);
  if (envPath !== undefined) return envPath;
  return join(resolveRepositoryRoot(process.cwd()), "logs", "auto-develop-queue.json");
};

const writeAtomically = (snapshotPath: string, serialized: string): void => {
  const stagingPath = `${snapshotPath}.tmp`;
  writeFileSync(stagingPath, serialized);
  renameSync(stagingPath, snapshotPath);
};

export type SnapshotWriter = {
  readonly write: (
    jobs: readonly {
      readonly id: string;
      readonly type: string;
      readonly payload: unknown;
      readonly key: string;
      readonly lane: string;
      readonly label: string;
      readonly state: string;
      readonly acceptedAt: string;
    }[],
  ) => void;
};

export const createSnapshotWriter = (writer: {
  readonly snapshotPath: string;
  readonly log: Logger;
}): SnapshotWriter => ({
  write: (jobs) => {
    const serialized = `${JSON.stringify({ jobs }, null, 2)}\n`;
    try {
      writeAtomically(writer.snapshotPath, serialized);
    } catch (firstFailure) {
      try {
        mkdirSync(dirname(writer.snapshotPath), { recursive: true });
        writeAtomically(writer.snapshotPath, serialized);
      } catch (retryFailure) {
        writer.log.error(
          { snapshotPath: writer.snapshotPath, err: retryFailure, firstErr: firstFailure },
          "queue snapshot write failed; continuing on memory",
        );
      }
    }
  },
});
