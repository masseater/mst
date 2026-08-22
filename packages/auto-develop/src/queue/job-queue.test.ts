import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { createJobQueue } from "./job-queue.ts";

type SnapshotFile = { readonly jobs: readonly Record<string, unknown>[] };

describe("構築", () => {
  const it = test
    .extend("zeroConcurrencyFailure", () => {
      try {
        createJobQueue({ concurrency: 0 });
      } catch (failure) {
        return failure;
      }
      throw new Error("a concurrency of 0 was accepted");
    })
    .extend("fractionalConcurrencyFailure", () => {
      try {
        createJobQueue({ concurrency: 1.5 });
      } catch (failure) {
        return failure;
      }
      throw new Error("a fractional concurrency was accepted");
    })
    .extend("freshSnapshotContent", () => {
      const snapshotPath = join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json");
      createJobQueue({ concurrency: 1, snapshotPath });
      return JSON.parse(readFileSync(snapshotPath, "utf8")) as SnapshotFile;
    })
    .extend("sizeAfterLeftoverFile", () => {
      const snapshotPath = join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json");
      writeFileSync(snapshotPath, JSON.stringify({ jobs: [{ id: "job-stale", lane: "pr-9" }] }));
      return createJobQueue({ concurrency: 1, snapshotPath }).size();
    })
    .extend("snapshotContentAfterLeftoverFile", () => {
      const snapshotPath = join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json");
      writeFileSync(snapshotPath, JSON.stringify({ jobs: [{ id: "job-stale", lane: "pr-9" }] }));
      createJobQueue({ concurrency: 1, snapshotPath });
      return JSON.parse(readFileSync(snapshotPath, "utf8")) as SnapshotFile;
    });

  it("並行度 0 は正の整数でない旨のエラーで拒否される", ({ zeroConcurrencyFailure }) => {
    expect(zeroConcurrencyFailure).toStrictEqual(
      new Error("concurrency must be a positive integer"),
    );
  });

  it("小数の並行度も同じ形で拒否される", ({ fractionalConcurrencyFailure }) => {
    expect(fractionalConcurrencyFailure).toStrictEqual(
      new Error("concurrency must be a positive integer"),
    );
  });

  it("構築直後に空のジョブ配列がファイルへ書かれる", ({ freshSnapshotContent }) => {
    expect(freshSnapshotContent).toStrictEqual({ jobs: [] });
  });

  it("前任がジョブを残したファイルがあっても新インスタンスは空で始まる", ({
    sizeAfterLeftoverFile,
  }) => {
    expect(sizeAfterLeftoverFile).toStrictEqual({ waiting: 0, running: 0 });
  });

  it("前任が残したジョブはファイルからも読み戻されない", ({ snapshotContentAfterLeftoverFile }) => {
    expect(snapshotContentAfterLeftoverFile).toStrictEqual({ jobs: [] });
  });
});

describe("排水と順序", () => {
  const it = test
    .extend("singleJobHandler", async () => {
      const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": handled },
      });
      queue.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "a",
        lane: "pr-7",
        label: "j",
      });
      await queue.drain();
      return handled;
    })
    .extend("arrivalOrderHandler", async () => {
      const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": handled },
      });
      queue.enqueue({ type: "pr-events", payload: "pr-90", key: "a", lane: "pr-90", label: "j" });
      queue.enqueue({ type: "pr-events", payload: "pr-2", key: "b", lane: "pr-2", label: "j" });
      await queue.drain();
      return handled;
    })
    .extend("fourLaneHandler", async () => {
      const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
      const queue = createJobQueue({
        concurrency: 2,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": handled },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-1", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "b", lane: "pr-2", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "c", lane: "pr-3", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "d", lane: "pr-4", label: "j" });
      await queue.drain();
      return handled;
    })
    .extend("chainedHandler", async () => {
      const blockerDone = Promise.withResolvers<undefined>();
      const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { blocker: () => blockerDone.promise, "pr-events": handled },
        waitingSerializedTypes: ["pr-events"],
      });
      queue.enqueue({ type: "blocker", payload: 1, key: "a", lane: "pr-1", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "b", lane: "pr-7", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "c", lane: "pr-7", label: "j" });
      blockerDone.resolve(undefined);
      await queue.drain();
      return handled;
    });

  it("受け付けたジョブは登録済み処理本体でちょうど 1 回処理される", ({ singleJobHandler }) => {
    expect(singleJobHandler).toHaveBeenCalledTimes(1);
  });

  it("受け付けたジョブの積荷がそのまま処理本体へ渡る", ({ singleJobHandler }) => {
    expect(singleJobHandler).toHaveBeenCalledWith({ revision: 1 });
  });

  it("番号の大小に優先は無く先に届いたジョブが先に実行される", ({ arrivalOrderHandler }) => {
    expect(arrivalOrderHandler).toHaveBeenNthCalledWith(1, "pr-90");
  });

  it("後から届いたジョブは二番目に実行される", ({ arrivalOrderHandler }) => {
    expect(arrivalOrderHandler).toHaveBeenNthCalledWith(2, "pr-2");
  });

  it("並行度 2 で全別レーン 4 件が漏れなく排水される", ({ fourLaneHandler }) => {
    expect(fourLaneHandler).toHaveBeenCalledTimes(4);
  });

  it("同期的に即完了する処理でも drain は連鎖起動される後続分まで待つ", ({ chainedHandler }) => {
    expect(chainedHandler).toHaveBeenCalledTimes(2);
  });
});

describe("観測系とスナップショット", () => {
  const it = test
    .extend("runningLanesWhileBusy", async () => {
      const jobDone = Promise.withResolvers<undefined>();
      const queue = createJobQueue({
        concurrency: 2,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": () => jobDone.promise },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-9", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "b", lane: "pr-10", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "c", lane: "pr-9", label: "j" });
      const runningLanes = queue.runningLanes();
      jobDone.resolve(undefined);
      await queue.drain();
      return runningLanes;
    })
    .extend("waitingLanesWhileBusy", async () => {
      const jobDone = Promise.withResolvers<undefined>();
      const queue = createJobQueue({
        concurrency: 2,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": () => jobDone.promise },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-9", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "b", lane: "pr-10", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "c", lane: "pr-9", label: "j" });
      const waitingLanes = queue.waitingLanes();
      jobDone.resolve(undefined);
      await queue.drain();
      return waitingLanes;
    })
    .extend("sizeWhileBusy", async () => {
      const jobDone = Promise.withResolvers<undefined>();
      const queue = createJobQueue({
        concurrency: 2,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": () => jobDone.promise },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-9", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "b", lane: "pr-10", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "c", lane: "pr-9", label: "j" });
      const busySize = queue.size();
      jobDone.resolve(undefined);
      await queue.drain();
      return busySize;
    })
    .extend("idleWhileBusy", async () => {
      const jobDone = Promise.withResolvers<undefined>();
      const queue = createJobQueue({
        concurrency: 2,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": () => jobDone.promise },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-9", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "b", lane: "pr-10", label: "j" });
      const busyIdle = queue.isIdle();
      jobDone.resolve(undefined);
      await queue.drain();
      return busyIdle;
    })
    .extend("targetedLaneAdmission", () => {
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        prFilter: { targetPrs: [7], excludedPrs: [8] },
      });
      return queue.admitsLane("pr-7");
    })
    .extend("excludedLaneAdmission", () => {
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        prFilter: { targetPrs: [7], excludedPrs: [8] },
      });
      return queue.admitsLane("pr-8");
    })
    .extend("unlistedLaneAdmission", () => {
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        prFilter: { targetPrs: [7], excludedPrs: [8] },
      });
      return queue.admitsLane("pr-9");
    })
    .extend("nonPrLaneAdmission", () => {
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        prFilter: { targetPrs: [7], excludedPrs: [8] },
      });
      return queue.admitsLane("system-maintenance");
    })
    .extend("waitingLanesWhileFirstRuns", async () => {
      const jobDone = Promise.withResolvers<undefined>();
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": () => jobDone.promise },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-1", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "b", lane: "pr-9", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "c", lane: "pr-10", label: "j" });
      const waitingLanes = queue.waitingLanes();
      jobDone.resolve(undefined);
      await queue.drain();
      return waitingLanes;
    })
    .extend("runningSnapshotContent", async () => {
      const snapshotPath = join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json");
      const jobDone = Promise.withResolvers<undefined>();
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath,
        handlers: { "pr-events": () => jobDone.promise },
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => "job-fixed",
      });
      queue.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      const runningContent = JSON.parse(readFileSync(snapshotPath, "utf8")) as SnapshotFile;
      jobDone.resolve(undefined);
      await queue.drain();
      return runningContent;
    })
    .extend("snapshotContentAfterDrain", async () => {
      const snapshotPath = join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json");
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath,
        handlers: { "pr-events": () => Promise.resolve() },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-7", label: "j" });
      await queue.drain();
      return JSON.parse(readFileSync(snapshotPath, "utf8")) as SnapshotFile;
    })
    .extend("brokenTargetHandler", async () => {
      const blockedDir = mkdtempSync(join(tmpdir(), "job-queue-blocked-"));
      writeFileSync(join(blockedDir, "occupied"), "");
      const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(blockedDir, "occupied", "queue.json"),
        handlers: { "pr-events": handled },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-7", label: "j" });
      await queue.drain();
      return handled;
    })
    .extend("brokenTargetErrorLog", async () => {
      const blockedDir = mkdtempSync(join(tmpdir(), "job-queue-blocked-"));
      writeFileSync(join(blockedDir, "occupied"), "");
      const errorLog =
        vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(blockedDir, "occupied", "queue.json"),
        handlers: { "pr-events": () => Promise.resolve() },
        log: { info: () => undefined, warn: () => undefined, error: errorLog },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-7", label: "j" });
      await queue.drain();
      return errorLog;
    });

  it("実行中のレーン一覧は辞書順で並ぶ", ({ runningLanesWhileBusy }) => {
    expect(runningLanesWhileBusy).toStrictEqual(["pr-10", "pr-9"]);
  });

  it("待機中のレーン一覧は実行中のレーンを含まない", ({ waitingLanesWhileBusy }) => {
    expect(waitingLanesWhileBusy).toStrictEqual([]);
  });

  it("同レーンの後続は待機に積まれず件数にも出ない", ({ sizeWhileBusy }) => {
    expect(sizeWhileBusy).toStrictEqual({ waiting: 0, running: 2 });
  });

  it("実行中のジョブがあれば手空きではない", ({ idleWhileBusy }) => {
    expect(idleWhileBusy).toBe(false);
  });

  it("包含リストに載る PR レーンは事前判定を通る", ({ targetedLaneAdmission }) => {
    expect(targetedLaneAdmission).toBe(true);
  });

  it("除外リストの PR レーンは事前判定で落ちる", ({ excludedLaneAdmission }) => {
    expect(excludedLaneAdmission).toBe(false);
  });

  it("包含リストに載らない PR レーンは事前判定で落ちる", ({ unlistedLaneAdmission }) => {
    expect(unlistedLaneAdmission).toBe(false);
  });

  it("PR レーンでないレーンは事前判定を通る", ({ nonPrLaneAdmission }) => {
    expect(nonPrLaneAdmission).toBe(true);
  });

  it("待機中レーン一覧は実行中レーンを含まず辞書順で並ぶ", ({ waitingLanesWhileFirstRuns }) => {
    expect(waitingLanesWhileFirstRuns).toStrictEqual(["pr-10", "pr-9"]);
  });

  it("実行中ジョブは全フィールド付きでファイルに載る", ({ runningSnapshotContent }) => {
    expect(runningSnapshotContent).toStrictEqual({
      jobs: [
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
      ],
    });
  });

  it("完了したジョブはファイルから消える", ({ snapshotContentAfterDrain }) => {
    expect(snapshotContentAfterDrain).toStrictEqual({ jobs: [] });
  });

  it("書き込み先が壊れていても受付と実行は続く", ({ brokenTargetHandler }) => {
    expect(brokenTargetHandler).toHaveBeenCalledTimes(1);
  });

  it("書き込み先が壊れていればエラーログが出る", ({ brokenTargetErrorLog }) => {
    expect(brokenTargetErrorLog).toHaveBeenCalledTimes(4);
  });
});

describe("パス解決", () => {
  const it = test.extend("envResolvedSnapshotContent", () => {
    const snapshotPath = join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json");
    createJobQueue({ concurrency: 1, env: { AUTO_DEVELOP_QUEUE_PATH: snapshotPath } });
    return JSON.parse(readFileSync(snapshotPath, "utf8")) as SnapshotFile;
  });

  it("スナップショットパスは環境変数からも解決される", ({ envResolvedSnapshotContent }) => {
    expect(envResolvedSnapshotContent).toStrictEqual({ jobs: [] });
  });
});

describe("取り消しと予約", () => {
  const it = test
    .extend("canceledWaitingCount", async () => {
      const jobDone = Promise.withResolvers<undefined>();
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": () => jobDone.promise },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-1", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "b", lane: "pr-2", label: "j" });
      const canceledWaiting = queue.cancelLane("pr-2");
      jobDone.resolve(undefined);
      await queue.drain();
      return canceledWaiting;
    })
    .extend("unknownLaneCancelCount", async () => {
      const jobDone = Promise.withResolvers<undefined>();
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": () => jobDone.promise },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-1", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "b", lane: "pr-2", label: "j" });
      const canceledUnknown = queue.cancelLane("pr-9");
      jobDone.resolve(undefined);
      await queue.drain();
      return canceledUnknown;
    })
    .extend("canceledLaneHandler", async () => {
      const jobDone = Promise.withResolvers<undefined>();
      const handled = vi.fn<(payload: unknown) => Promise<void>>(() => jobDone.promise);
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": handled },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-1", label: "j" });
      queue.enqueue({ type: "pr-events", payload: 1, key: "b", lane: "pr-2", label: "j" });
      queue.cancelLane("pr-2");
      jobDone.resolve(undefined);
      await queue.drain();
      return handled;
    })
    .extend("freeLaneReservation", async () => {
      const jobDone = Promise.withResolvers<undefined>();
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": () => jobDone.promise },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-1", label: "j" });
      const reserved = await queue.reserveLane("pr-2", () => Promise.resolve("cleaned"));
      jobDone.resolve(undefined);
      await queue.drain();
      return reserved;
    })
    .extend("busyLaneReservation", async () => {
      const jobDone = Promise.withResolvers<undefined>();
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": () => jobDone.promise },
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-1", label: "j" });
      const denied = await queue.reserveLane("pr-1", () => Promise.resolve("cleaned"));
      jobDone.resolve(undefined);
      await queue.drain();
      return denied;
    })
    .extend("reservedLaneSequence", async () => {
      const cleanupDone = Promise.withResolvers<string>();
      const sequence = vi.fn<(step: string) => void>();
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: {
          "pr-events": () => {
            sequence("job");
            return Promise.resolve();
          },
        },
      });
      const reserving = queue.reserveLane("pr-7", () => {
        sequence("cleanup started");
        return cleanupDone.promise;
      });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-7", label: "j" });
      sequence("accepted while reserved");
      cleanupDone.resolve("cleaned");
      await reserving;
      await queue.drain();
      return sequence;
    });

  it("待機レーンの取り消しは件数を返す", ({ canceledWaitingCount }) => {
    expect(canceledWaitingCount).toBe(1);
  });

  it("待機ジョブの無いレーンの取り消しは 0 件になる", ({ unknownLaneCancelCount }) => {
    expect(unknownLaneCancelCount).toBe(0);
  });

  it("取り消した待機ジョブの処理本体は決して呼ばれない", ({ canceledLaneHandler }) => {
    expect(canceledLaneHandler).toHaveBeenCalledTimes(1);
  });

  it("空きレーンの予約はタスクの戻り値を返す", ({ freeLaneReservation }) => {
    expect(freeLaneReservation).toBe("cleaned");
  });

  it("待機ジョブのあるレーンの予約は不成立になる", ({ busyLaneReservation }) => {
    expect(busyLaneReservation).toBe(null);
  });

  it("予約中のレーンの掃除は予約した時点で始まる", ({ reservedLaneSequence }) => {
    expect(reservedLaneSequence).toHaveBeenNthCalledWith(1, "cleanup started");
  });

  it("予約中のレーンでもジョブの受付は続く", ({ reservedLaneSequence }) => {
    expect(reservedLaneSequence).toHaveBeenNthCalledWith(2, "accepted while reserved");
  });

  it("予約中のレーンに受けたジョブは掃除完了後に始まる", ({ reservedLaneSequence }) => {
    expect(reservedLaneSequence).toHaveBeenNthCalledWith(3, "job");
  });
});

describe("差し替え", () => {
  const it = test
    .extend("replacedHandler", async () => {
      const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": handled },
      });
      queue.setHandlers({ handlers: { "pr-events": () => Promise.resolve() } });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-7", label: "j" });
      await queue.drain();
      return handled;
    })
    .extend("replacingHandler", async () => {
      const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
      const queue = createJobQueue({
        concurrency: 1,
        snapshotPath: join(mkdtempSync(join(tmpdir(), "job-queue-")), "queue.json"),
        handlers: { "pr-events": () => Promise.resolve() },
      });
      queue.setHandlers({ handlers: { "pr-events": handled } });
      queue.enqueue({ type: "pr-events", payload: 1, key: "a", lane: "pr-7", label: "j" });
      await queue.drain();
      return handled;
    });

  it("setHandlers 前の処理本体は使われない", ({ replacedHandler }) => {
    expect(replacedHandler).toHaveBeenCalledTimes(0);
  });

  it("setHandlers は最新の処理本体だけを使う", ({ replacingHandler }) => {
    expect(replacingHandler).toHaveBeenCalledTimes(1);
  });
});
