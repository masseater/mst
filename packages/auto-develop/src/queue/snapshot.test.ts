import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createSnapshotWriter, resolveSnapshotPath } from "./snapshot.ts";

describe("resolveSnapshotPath", () => {
  test("明示パスが最優先で使われる", () => {
    expect(
      resolveSnapshotPath({
        explicitPath: "/var/queue.json",
        env: { AUTO_DEVELOP_QUEUE_PATH: "/env" },
      }),
    ).toStrictEqual("/var/queue.json");
  });

  test("明示パスの空文字は未指定と同じ扱いで環境変数に落ちる", () => {
    expect(
      resolveSnapshotPath({
        explicitPath: "",
        env: { AUTO_DEVELOP_QUEUE_PATH: "/env/queue.json" },
      }),
    ).toStrictEqual("/env/queue.json");
  });

  test("どちらも無ければリポジトリルート配下の既定パスに落ちる", () => {
    expect(resolveSnapshotPath({ explicitPath: undefined, env: {} })).toMatch(
      /logs\/auto-develop-queue\.json$/,
    );
  });

  test("env を渡さなければプロセスの環境を読む", () => {
    vi.stubEnv("AUTO_DEVELOP_QUEUE_PATH", "/stubbed/queue.json");
    const resolved = resolveSnapshotPath({ explicitPath: undefined });
    vi.unstubAllEnvs();
    expect(resolved).toStrictEqual("/stubbed/queue.json");
  });
});

describe("createSnapshotWriter", () => {
  test("インデント付き JSON が末尾改行付きで原子的に書かれる", () => {
    const snapshotPath = join(mkdtempSync(join(tmpdir(), "auto-develop-snap-")), "queue.json");
    const writer = createSnapshotWriter({ snapshotPath, log: silentLogger });
    writer.write([]);
    expect(readFileSync(snapshotPath, "utf8")).toStrictEqual('{\n  "jobs": []\n}\n');
  });

  test("親ディレクトリが無ければ 1 回だけ作り直して書く", () => {
    const baseDir = mkdtempSync(join(tmpdir(), "auto-develop-snap-"));
    const snapshotPath = join(baseDir, "missing", "queue.json");
    const writer = createSnapshotWriter({ snapshotPath, log: silentLogger });
    writer.write([]);
    expect(JSON.parse(readFileSync(snapshotPath, "utf8"))).toStrictEqual({ jobs: [] });
  });

  test("再試行も失敗したらエラーログを残してメモリ運転を続ける", () => {
    const baseDir = mkdtempSync(join(tmpdir(), "auto-develop-snap-"));
    writeFileSync(join(baseDir, "occupied"), "");
    const errorLog = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
    const writer = createSnapshotWriter({
      snapshotPath: join(baseDir, "occupied", "queue.json"),
      log: { info: () => undefined, warn: () => undefined, error: errorLog },
    });
    writer.write([]);
    expect(errorLog.mock.calls.length).toStrictEqual(1);
  });
});
