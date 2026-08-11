import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { createJobQueue, type JobQueueConfig } from "./job-queue.ts";

import type { JobIntake } from "./job-intake.ts";

const snapshotPathIn = (): string =>
  join(mkdtempSync(join(tmpdir(), "auto-develop-queue-")), "queue.json");

const intake = (shape: Partial<JobIntake> = {}): JobIntake => ({
  type: "pr-events",
  payload: { revision: 1 },
  key: `key-${Math.trunc(Math.random() * 1_000_000)}`,
  lane: "pr-7",
  label: "pr-events for PR #7",
  ...shape,
});

const queueWith = (config: Partial<JobQueueConfig> = {}) =>
  createJobQueue({
    concurrency: 1,
    snapshotPath: snapshotPathIn(),
    ...config,
  });

describe("構築", () => {
  test("並行度 0 は正の整数でない旨のエラーで拒否される", () => {
    expect(() => queueWith({ concurrency: 0 })).toThrow("concurrency must be a positive integer");
  });

  test("小数の並行度も同じ形で拒否される", () => {
    expect(() => queueWith({ concurrency: 1.5 })).toThrow("concurrency must be a positive integer");
  });

  test("構築直後に空のジョブ配列がファイルへ書かれる", () => {
    const snapshotPath = snapshotPathIn();
    queueWith({ snapshotPath });
    expect(JSON.parse(readFileSync(snapshotPath, "utf8"))).toStrictEqual({ jobs: [] });
  });

  test("前任がジョブを残したファイルがあっても新インスタンスは空で始まり読み戻さない", () => {
    const snapshotPath = snapshotPathIn();
    writeFileSync(
      snapshotPath,
      JSON.stringify({ jobs: [{ id: "job-stale", lane: "pr-9", state: "waiting" }] }),
    );
    const jobQueue = queueWith({ snapshotPath });
    expect([jobQueue.size(), JSON.parse(readFileSync(snapshotPath, "utf8"))]).toStrictEqual([
      { waiting: 0, running: 0 },
      { jobs: [] },
    ]);
  });
});

describe("排水と順序", () => {
  test("受け付けたジョブは登録済み処理本体でちょうど 1 回処理される", async () => {
    const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const jobQueue = queueWith({ handlers: { "pr-events": handled } });
    jobQueue.enqueue(intake());
    await jobQueue.drain();
    expect(handled.mock.calls).toStrictEqual([[{ revision: 1 }]]);
  });

  test("番号の大小に優先は無く到着順に実行される", async () => {
    const startedLanes = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const jobQueue = queueWith({ handlers: { "pr-events": startedLanes } });
    jobQueue.enqueue(intake({ lane: "pr-90", payload: { lane: "pr-90" }, key: "key-90" }));
    jobQueue.enqueue(intake({ lane: "pr-2", payload: { lane: "pr-2" }, key: "key-2" }));
    await jobQueue.drain();
    expect(startedLanes.mock.calls.map(([payload]) => payload)).toStrictEqual([
      { lane: "pr-90" },
      { lane: "pr-2" },
    ]);
  });

  test("並行度 2 で全別レーン 4 件が漏れなく排水される", async () => {
    const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const jobQueue = queueWith({ concurrency: 2, handlers: { "pr-events": handled } });
    for (const prNumber of [1, 2, 3, 4]) {
      jobQueue.enqueue(intake({ lane: `pr-${prNumber}`, key: `key-${prNumber}` }));
    }
    await jobQueue.drain();
    expect(handled.mock.calls.length).toStrictEqual(4);
  });

  test("同期的に即完了する処理でも drain は連鎖起動される後続分まで待つ", async () => {
    const gate = new Map<string, () => void>();
    const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const jobQueue = queueWith({
      concurrency: 1,
      handlers: {
        blocker: () =>
          new Promise<void>((resolve) => {
            gate.set("release", resolve);
          }),
        "pr-events": handled,
      },
      waitingSerializedTypes: ["pr-events"],
    });
    jobQueue.enqueue(intake({ type: "blocker", lane: "pr-1", key: "key-blocker" }));
    jobQueue.enqueue(intake({ key: "key-1" }));
    jobQueue.enqueue(intake({ key: "key-2" }));
    gate.get("release")?.();
    await jobQueue.drain();
    expect(handled.mock.calls.length).toStrictEqual(2);
  });
});

describe("観測系とスナップショット", () => {
  test("実行中と待機中のレーン一覧は互いを含まず辞書順で並ぶ", async () => {
    const gate = new Map<string, () => void>();
    const jobQueue = queueWith({
      concurrency: 2,
      handlers: {
        "pr-events": () =>
          new Promise<void>((resolve) => {
            gate.set(`release-${gate.size}`, resolve);
          }),
      },
    });
    jobQueue.enqueue(intake({ lane: "pr-9", key: "key-9" }));
    jobQueue.enqueue(intake({ lane: "pr-10", key: "key-10" }));
    jobQueue.enqueue(intake({ lane: "pr-9", key: "key-9b", label: "waiting job" }));
    expect([
      jobQueue.runningLanes(),
      jobQueue.waitingLanes(),
      jobQueue.size(),
      jobQueue.isIdle(),
    ]).toStrictEqual([["pr-10", "pr-9"], [], { waiting: 0, running: 2 }, false]);
    gate.get("release-0")?.();
    gate.get("release-1")?.();
    await jobQueue.drain();
  });

  test("レーンの事前判定はフィルタの 4 パターンに答える", () => {
    const jobQueue = queueWith({ prFilter: { targetPrs: [7], excludedPrs: [8] } });
    expect([
      jobQueue.admitsLane("pr-7"),
      jobQueue.admitsLane("pr-8"),
      jobQueue.admitsLane("pr-9"),
      jobQueue.admitsLane("system-maintenance"),
    ]).toStrictEqual([true, false, false, true]);
  });

  test("待機中レーン一覧は実行中レーンを含まず辞書順で並ぶ", async () => {
    const gate = new Map<string, () => void>();
    const handledCalls = new Map<number, true>();
    const jobQueue = queueWith({
      handlers: {
        "pr-events": () => {
          if (handledCalls.size > 0) return Promise.resolve();
          handledCalls.set(handledCalls.size, true);
          return new Promise<void>((resolve) => {
            gate.set("release", resolve);
          });
        },
      },
    });
    jobQueue.enqueue(intake({ lane: "pr-1", key: "key-1" }));
    jobQueue.enqueue(intake({ lane: "pr-9", key: "key-9" }));
    jobQueue.enqueue(intake({ lane: "pr-10", key: "key-10" }));
    const waitingLanes = jobQueue.waitingLanes();
    gate.get("release")?.();
    await jobQueue.drain();
    expect(waitingLanes).toStrictEqual(["pr-10", "pr-9"]);
  });

  test("実行中ジョブは全フィールド付きでファイルに載り完了で消える", async () => {
    const snapshotPath = snapshotPathIn();
    const gate = new Map<string, () => void>();
    const jobQueue = createJobQueue({
      concurrency: 1,
      snapshotPath,
      handlers: {
        "pr-events": () =>
          new Promise<void>((resolve) => {
            gate.set("release", resolve);
          }),
      },
      nowIso: () => "2026-08-11T00:00:00.000Z",
      nextId: () => "job-fixed",
    });
    jobQueue.enqueue(intake({ key: "key-1" }));
    const runningSnapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
      readonly jobs: readonly Record<string, unknown>[];
    };
    gate.get("release")?.();
    await jobQueue.drain();
    expect([runningSnapshot.jobs[0], JSON.parse(readFileSync(snapshotPath, "utf8"))]).toStrictEqual(
      [
        {
          id: "job-fixed",
          type: "pr-events",
          payload: { revision: 1 },
          key: "key-1",
          lane: "pr-7",
          label: "pr-events for PR #7",
          state: "running",
          acceptedAt: "2026-08-11T00:00:00.000Z",
        },
        { jobs: [] },
      ],
    );
  });

  test("書き込み先が壊れていても受付と実行は続きエラーログが出る", async () => {
    const blockedDir = mkdtempSync(join(tmpdir(), "auto-develop-blocked-"));
    writeFileSync(join(blockedDir, "occupied"), "");
    const errorLog = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
    const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const jobQueue = createJobQueue({
      concurrency: 1,
      snapshotPath: join(blockedDir, "occupied", "queue.json"),
      handlers: { "pr-events": handled },
      log: { info: () => undefined, warn: () => undefined, error: errorLog },
    });
    jobQueue.enqueue(intake());
    await jobQueue.drain();
    expect([handled.mock.calls.length, errorLog.mock.calls.length]).toStrictEqual([1, 4]);
  });
});

describe("パス解決", () => {
  test("スナップショットパスは環境変数からも解決される", () => {
    const snapshotPath = snapshotPathIn();
    createJobQueue({ concurrency: 1, env: { AUTO_DEVELOP_QUEUE_PATH: snapshotPath } });
    expect(JSON.parse(readFileSync(snapshotPath, "utf8"))).toStrictEqual({ jobs: [] });
  });
});

describe("取り消しと予約", () => {
  test("待機レーンの取り消しは件数を返し処理本体は決して呼ばれない", async () => {
    const gate = new Map<string, () => void>();
    const handled = vi.fn<(payload: unknown) => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          gate.set("release", resolve);
        }),
    );
    const jobQueue = queueWith({ handlers: { "pr-events": handled } });
    jobQueue.enqueue(intake({ lane: "pr-1", key: "key-1" }));
    jobQueue.enqueue(intake({ lane: "pr-2", key: "key-2" }));
    const canceledCount = jobQueue.cancelLane("pr-2");
    gate.get("release")?.();
    await jobQueue.drain();
    expect([canceledCount, jobQueue.cancelLane("pr-9"), handled.mock.calls.length]).toStrictEqual([
      1, 0, 1,
    ]);
  });

  test("空きレーンの予約はタスクの戻り値を返し待機ジョブのあるレーンでは不成立になる", async () => {
    const gate = new Map<string, () => void>();
    const jobQueue = queueWith({
      handlers: {
        "pr-events": () =>
          new Promise<void>((resolve) => {
            gate.set("release", resolve);
          }),
      },
    });
    jobQueue.enqueue(intake({ lane: "pr-1", key: "key-1" }));
    const cleanedValue = await jobQueue.reserveLane("pr-2", () => Promise.resolve("cleaned"));
    const deniedReservation = await jobQueue.reserveLane("pr-1", () => Promise.resolve("cleaned"));
    gate.get("release")?.();
    await jobQueue.drain();
    expect([cleanedValue, deniedReservation]).toStrictEqual(["cleaned", null]);
  });

  test("予約中のレーンに受けたジョブは掃除完了後に始まる", async () => {
    const sequence = vi.fn<(step: string) => void>();
    const cleanupGate = new Map<string, () => void>();
    const jobQueue = queueWith({
      handlers: {
        "pr-events": () => {
          sequence("job");
          return Promise.resolve();
        },
      },
    });
    const reserving = jobQueue.reserveLane("pr-7", () => {
      sequence("cleanup started");
      return new Promise<string>((resolve) => {
        cleanupGate.set("finish", () => {
          resolve("cleaned");
        });
      });
    });
    jobQueue.enqueue(intake());
    sequence("accepted while reserved");
    cleanupGate.get("finish")?.();
    await reserving;
    await jobQueue.drain();
    expect(sequence.mock.calls.map(([step]) => step)).toStrictEqual([
      "cleanup started",
      "accepted while reserved",
      "job",
    ]);
  });
});

describe("差し替え", () => {
  test("setHandlers は最新の処理本体だけを使う", async () => {
    const firstHandler = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const secondHandler = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const jobQueue = queueWith({ handlers: { "pr-events": firstHandler } });
    jobQueue.setHandlers({ handlers: { "pr-events": secondHandler } });
    jobQueue.enqueue(intake());
    await jobQueue.drain();
    expect([firstHandler.mock.calls.length, secondHandler.mock.calls.length]).toStrictEqual([0, 1]);
  });
});
