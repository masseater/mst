import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createSnapshotWriter, resolveSnapshotPath } from "./snapshot.ts";

type SnapshotFile = { readonly jobs: readonly Record<string, unknown>[] };

describe("resolveSnapshotPath", () => {
  const it = test
    .extend("explicitlyGivenPath", () =>
      resolveSnapshotPath({
        explicitPath: "/var/queue.json",
        env: { AUTO_DEVELOP_QUEUE_PATH: "/env" },
      }))
    .extend("pathForEmptyExplicitPath", () =>
      resolveSnapshotPath({
        explicitPath: "",
        env: { AUTO_DEVELOP_QUEUE_PATH: "/env/queue.json" },
      }),
    )
    .extend("pathWithoutAnyHint", () => {
      vi.spyOn(process, "cwd").mockReturnValue("/directory-without-git-marker");
      return resolveSnapshotPath({ explicitPath: undefined, env: {} });
    })
    .extend("pathFromProcessEnv", () => {
      vi.stubEnv("AUTO_DEVELOP_QUEUE_PATH", "/stubbed/queue.json");
      return resolveSnapshotPath({ explicitPath: undefined });
    });

  it("明示パスが最優先で使われる", ({ explicitlyGivenPath }) => {
    expect(explicitlyGivenPath).toStrictEqual("/var/queue.json");
  });

  it("明示パスの空文字は未指定と同じ扱いで環境変数に落ちる", ({ pathForEmptyExplicitPath }) => {
    expect(pathForEmptyExplicitPath).toStrictEqual("/env/queue.json");
  });

  it("どちらも無ければリポジトリルート配下の既定パスに落ちる", ({ pathWithoutAnyHint }) => {
    expect(pathWithoutAnyHint).toBe("/directory-without-git-marker/logs/auto-develop-queue.json");
  });

  it("env を渡さなければプロセスの環境を読む", ({ pathFromProcessEnv }) => {
    expect(pathFromProcessEnv).toStrictEqual("/stubbed/queue.json");
  });
});

describe("createSnapshotWriter", () => {
  const it = test
    .extend("writtenFileText", () => {
      const snapshotPath = join(mkdtempSync(join(tmpdir(), "auto-develop-snap-")), "queue.json");
      const writer = createSnapshotWriter({ snapshotPath, log: silentLogger });
      writer.write([]);
      return readFileSync(snapshotPath, "utf8");
    })
    .extend("contentAfterMissingParent", () => {
      const baseDir = mkdtempSync(join(tmpdir(), "auto-develop-snap-"));
      const snapshotPath = join(baseDir, "missing", "queue.json");
      const writer = createSnapshotWriter({ snapshotPath, log: silentLogger });
      writer.write([]);
      return JSON.parse(readFileSync(snapshotPath, "utf8")) as SnapshotFile;
    })
    .extend("blockedWriteErrorLog", () => {
      const baseDir = mkdtempSync(join(tmpdir(), "auto-develop-snap-"));
      writeFileSync(join(baseDir, "occupied"), "");
      const errorLog =
        vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
      const writer = createSnapshotWriter({
        snapshotPath: join(baseDir, "occupied", "queue.json"),
        log: { info: () => undefined, warn: () => undefined, error: errorLog },
      });
      writer.write([]);
      return errorLog;
    });

  it("インデント付き JSON が末尾改行付きで原子的に書かれる", ({ writtenFileText }) => {
    expect(writtenFileText).toStrictEqual('{\n  "jobs": []\n}\n');
  });

  it("親ディレクトリが無ければ 1 回だけ作り直して書く", ({ contentAfterMissingParent }) => {
    expect(contentAfterMissingParent).toStrictEqual({ jobs: [] });
  });

  it("再試行も失敗したらエラーログを残してメモリ運転を続ける", ({ blockedWriteErrorLog }) => {
    expect(blockedWriteErrorLog).toHaveBeenCalledTimes(1);
  });
});
