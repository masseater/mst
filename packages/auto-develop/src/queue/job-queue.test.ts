import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { createJobQueue, type JobQueueConfig } from "./job-queue.ts";

import type { JobIntake } from "./job-intake.ts";

type SnapshotFile = { readonly jobs: readonly Record<string, unknown>[] };

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

const it = test
  .extend("zeroConcurrencyFailure", (): Error | null => {
    try {
      queueWith({ concurrency: 0 });
      return null;
    } catch (failure) {
      return failure instanceof Error ? failure : null;
    }
  })
  .extend("fractionalConcurrencyFailure", (): Error | null => {
    try {
      queueWith({ concurrency: 1.5 });
      return null;
    } catch (failure) {
      return failure instanceof Error ? failure : null;
    }
  })
  .extend("freshSnapshotContent", () => {
    const snapshotPath = snapshotPathIn();
    queueWith({ snapshotPath });
    return JSON.parse(readFileSync(snapshotPath, "utf8")) as SnapshotFile;
  })
  .extend("startAfterLeftoverFile", () => {
    const snapshotPath = snapshotPathIn();
    writeFileSync(
      snapshotPath,
      JSON.stringify({ jobs: [{ id: "job-stale", lane: "pr-9", state: "waiting" }] }),
    );
    const jobQueue = queueWith({ snapshotPath });
    return {
      size: jobQueue.size(),
      snapshotContent: JSON.parse(readFileSync(snapshotPath, "utf8")) as SnapshotFile,
    };
  })
  .extend("singleJobHandlerCalls", async () => {
    const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const jobQueue = queueWith({ handlers: { "pr-events": handled } });
    jobQueue.enqueue(intake());
    await jobQueue.drain();
    return handled.mock.calls;
  })
  .extend("arrivalOrderHandlerCalls", async () => {
    const startedLanes = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const jobQueue = queueWith({ handlers: { "pr-events": startedLanes } });
    jobQueue.enqueue(intake({ lane: "pr-90", payload: { lane: "pr-90" }, key: "key-90" }));
    jobQueue.enqueue(intake({ lane: "pr-2", payload: { lane: "pr-2" }, key: "key-2" }));
    await jobQueue.drain();
    return startedLanes.mock.calls;
  })
  .extend("fourLaneHandlerCalls", async () => {
    const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const jobQueue = queueWith({ concurrency: 2, handlers: { "pr-events": handled } });
    for (const prNumber of [1, 2, 3, 4]) {
      jobQueue.enqueue(intake({ lane: `pr-${prNumber}`, key: `key-${prNumber}` }));
    }
    await jobQueue.drain();
    return handled.mock.calls;
  })
  .extend("chainedHandlerCalls", async () => {
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
    return handled.mock.calls;
  })
  .extend("laneObservationsWhileBusy", async () => {
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
    const observed = {
      runningLanes: jobQueue.runningLanes(),
      waitingLanes: jobQueue.waitingLanes(),
      size: jobQueue.size(),
      idle: jobQueue.isIdle(),
    };
    gate.get("release-0")?.();
    gate.get("release-1")?.();
    await jobQueue.drain();
    return observed;
  })
  .extend("laneAdmissions", () => {
    const jobQueue = queueWith({ prFilter: { targetPrs: [7], excludedPrs: [8] } });
    return {
      targeted: jobQueue.admitsLane("pr-7"),
      excluded: jobQueue.admitsLane("pr-8"),
      unlisted: jobQueue.admitsLane("pr-9"),
      nonPrLane: jobQueue.admitsLane("system-maintenance"),
    };
  })
  .extend("waitingLanesWhileFirstRuns", async () => {
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
    return waitingLanes;
  })
  .extend("runningJobOnFile", async () => {
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
    const runningSnapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as SnapshotFile;
    gate.get("release")?.();
    await jobQueue.drain();
    return {
      runningEntry: runningSnapshot.jobs[0],
      afterDrain: JSON.parse(readFileSync(snapshotPath, "utf8")) as SnapshotFile,
    };
  })
  .extend("runWithBrokenSnapshotTarget", async () => {
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
    return { handlerCalls: handled.mock.calls, errorLogCalls: errorLog.mock.calls };
  })
  .extend("envResolvedSnapshotContent", () => {
    const snapshotPath = snapshotPathIn();
    createJobQueue({ concurrency: 1, env: { AUTO_DEVELOP_QUEUE_PATH: snapshotPath } });
    return JSON.parse(readFileSync(snapshotPath, "utf8")) as SnapshotFile;
  })
  .extend("waitingLaneCancellation", async () => {
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
    return {
      canceledCount,
      unknownLaneCount: jobQueue.cancelLane("pr-9"),
      handlerCalls: handled.mock.calls,
    };
  })
  .extend("laneReservations", async () => {
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
    const cleaned = await jobQueue.reserveLane("pr-2", () => Promise.resolve("cleaned"));
    const denied = await jobQueue.reserveLane("pr-1", () => Promise.resolve("cleaned"));
    gate.get("release")?.();
    await jobQueue.drain();
    return { cleaned, denied };
  })
  .extend("reservedLaneSequence", async () => {
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
    return sequence.mock.calls;
  })
  .extend("handlerReplacement", async () => {
    const firstHandler = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const secondHandler = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const jobQueue = queueWith({ handlers: { "pr-events": firstHandler } });
    jobQueue.setHandlers({ handlers: { "pr-events": secondHandler } });
    jobQueue.enqueue(intake());
    await jobQueue.drain();
    return { firstCalls: firstHandler.mock.calls, secondCalls: secondHandler.mock.calls };
  });

describe("構築", () => {
  it("並行度 0 は正の整数でない旨のエラーで拒否される", ({ zeroConcurrencyFailure }) => {
    expect(zeroConcurrencyFailure?.message).toStrictEqual("concurrency must be a positive integer");
  });

  it("小数の並行度も同じ形で拒否される", ({ fractionalConcurrencyFailure }) => {
    expect(fractionalConcurrencyFailure?.message).toStrictEqual(
      "concurrency must be a positive integer",
    );
  });

  it("構築直後に空のジョブ配列がファイルへ書かれる", ({ freshSnapshotContent }) => {
    expect(freshSnapshotContent).toStrictEqual({ jobs: [] });
  });

  it("前任がジョブを残したファイルがあっても新インスタンスは空で始まる", ({
    startAfterLeftoverFile,
  }) => {
    expect(startAfterLeftoverFile.size).toStrictEqual({ waiting: 0, running: 0 });
  });

  it("前任が残したジョブはファイルからも読み戻されない", ({ startAfterLeftoverFile }) => {
    expect(startAfterLeftoverFile.snapshotContent).toStrictEqual({ jobs: [] });
  });
});

describe("排水と順序", () => {
  it("受け付けたジョブは登録済み処理本体でちょうど 1 回処理される", ({ singleJobHandlerCalls }) => {
    expect(singleJobHandlerCalls).toStrictEqual([[{ revision: 1 }]]);
  });

  it("番号の大小に優先は無く到着順に実行される", ({ arrivalOrderHandlerCalls }) => {
    expect(arrivalOrderHandlerCalls).toStrictEqual([[{ lane: "pr-90" }], [{ lane: "pr-2" }]]);
  });

  it("並行度 2 で全別レーン 4 件が漏れなく排水される", ({ fourLaneHandlerCalls }) => {
    expect(fourLaneHandlerCalls.length).toStrictEqual(4);
  });

  it("同期的に即完了する処理でも drain は連鎖起動される後続分まで待つ", ({
    chainedHandlerCalls,
  }) => {
    expect(chainedHandlerCalls.length).toStrictEqual(2);
  });
});

describe("観測系とスナップショット", () => {
  it("実行中のレーン一覧は辞書順で並ぶ", ({ laneObservationsWhileBusy }) => {
    expect(laneObservationsWhileBusy.runningLanes).toStrictEqual(["pr-10", "pr-9"]);
  });

  it("待機中のレーン一覧は実行中のレーンを含まない", ({ laneObservationsWhileBusy }) => {
    expect(laneObservationsWhileBusy.waitingLanes).toStrictEqual([]);
  });

  it("同レーンの後続は待機に積まれず件数にも出ない", ({ laneObservationsWhileBusy }) => {
    expect(laneObservationsWhileBusy.size).toStrictEqual({ waiting: 0, running: 2 });
  });

  it("実行中のジョブがあれば手空きではない", ({ laneObservationsWhileBusy }) => {
    expect(laneObservationsWhileBusy.idle).toStrictEqual(false);
  });

  it("包含リストに載る PR レーンは事前判定を通る", ({ laneAdmissions }) => {
    expect(laneAdmissions.targeted).toStrictEqual(true);
  });

  it("除外リストの PR レーンは事前判定で落ちる", ({ laneAdmissions }) => {
    expect(laneAdmissions.excluded).toStrictEqual(false);
  });

  it("包含リストに載らない PR レーンは事前判定で落ちる", ({ laneAdmissions }) => {
    expect(laneAdmissions.unlisted).toStrictEqual(false);
  });

  it("PR レーンでないレーンは事前判定を通る", ({ laneAdmissions }) => {
    expect(laneAdmissions.nonPrLane).toStrictEqual(true);
  });

  it("待機中レーン一覧は実行中レーンを含まず辞書順で並ぶ", ({ waitingLanesWhileFirstRuns }) => {
    expect(waitingLanesWhileFirstRuns).toStrictEqual(["pr-10", "pr-9"]);
  });

  it("実行中ジョブは全フィールド付きでファイルに載る", ({ runningJobOnFile }) => {
    expect(runningJobOnFile.runningEntry).toStrictEqual({
      id: "job-fixed",
      type: "pr-events",
      payload: { revision: 1 },
      key: "key-1",
      lane: "pr-7",
      label: "pr-events for PR #7",
      state: "running",
      acceptedAt: "2026-08-11T00:00:00.000Z",
    });
  });

  it("完了したジョブはファイルから消える", ({ runningJobOnFile }) => {
    expect(runningJobOnFile.afterDrain).toStrictEqual({ jobs: [] });
  });

  it("書き込み先が壊れていても受付と実行は続く", ({ runWithBrokenSnapshotTarget }) => {
    expect(runWithBrokenSnapshotTarget.handlerCalls.length).toStrictEqual(1);
  });

  it("書き込み先が壊れていればエラーログが出る", ({ runWithBrokenSnapshotTarget }) => {
    expect(runWithBrokenSnapshotTarget.errorLogCalls.length).toStrictEqual(4);
  });
});

describe("パス解決", () => {
  it("スナップショットパスは環境変数からも解決される", ({ envResolvedSnapshotContent }) => {
    expect(envResolvedSnapshotContent).toStrictEqual({ jobs: [] });
  });
});

describe("取り消しと予約", () => {
  it("待機レーンの取り消しは件数を返す", ({ waitingLaneCancellation }) => {
    expect(waitingLaneCancellation.canceledCount).toStrictEqual(1);
  });

  it("待機ジョブの無いレーンの取り消しは 0 件になる", ({ waitingLaneCancellation }) => {
    expect(waitingLaneCancellation.unknownLaneCount).toStrictEqual(0);
  });

  it("取り消した待機ジョブの処理本体は決して呼ばれない", ({ waitingLaneCancellation }) => {
    expect(waitingLaneCancellation.handlerCalls.length).toStrictEqual(1);
  });

  it("空きレーンの予約はタスクの戻り値を返す", ({ laneReservations }) => {
    expect(laneReservations.cleaned).toStrictEqual("cleaned");
  });

  it("待機ジョブのあるレーンの予約は不成立になる", ({ laneReservations }) => {
    expect(laneReservations.denied).toStrictEqual(null);
  });

  it("予約中のレーンに受けたジョブは掃除完了後に始まる", ({ reservedLaneSequence }) => {
    expect(reservedLaneSequence).toStrictEqual([
      ["cleanup started"],
      ["accepted while reserved"],
      ["job"],
    ]);
  });
});

describe("差し替え", () => {
  it("setHandlers 前の処理本体は使われない", ({ handlerReplacement }) => {
    expect(handlerReplacement.firstCalls.length).toStrictEqual(0);
  });

  it("setHandlers は最新の処理本体だけを使う", ({ handlerReplacement }) => {
    expect(handlerReplacement.secondCalls.length).toStrictEqual(1);
  });
});
