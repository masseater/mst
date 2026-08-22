import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { CredentialTerminalError } from "../transport/credential-provider.ts";
import { cycleUntilStopped } from "./cycle-loop.ts";

describe("cycleUntilStopped", () => {
  describe("再起動要求で終わる接続サイクル", () => {
    const it = test
      .extend("immediateCycleObservation", async () => {
        const observation = vi.fn<(event: string) => void>();
        const baseline = new Map<string, string>();
        await cycleUntilStopped({
          mode: "reviewer",
          runtime: {
            log: silentLogger,
            syncToMain: () => {
              observation("sync-main");
              return Promise.resolve();
            },
            drainStartup: () => {
              observation("startup-drain");
              return Promise.resolve([]);
            },
            connect: () => {
              observation("connect");
              return Promise.resolve();
            },
            subscribe: async function* subscribe() {
              observation("subscribe");
              yield {};
            },
            dispatcher: { dispatch: () => true },
            queue: {
              enqueue: () => true,
              enqueueFollowUp: () => true,
              setHandlers: () => undefined,
              runningLanes: () => [],
              waitingLanes: () => [],
              size: () => ({ waiting: 0, running: 0 }),
              isIdle: () => true,
              admitsLane: () => true,
              cancelLane: () => 0,
              drain: () => Promise.resolve(),
              reserveLane: () => Promise.resolve(null),
            },
            disconnect: () => undefined,
            remoteHeadCommit: () => {
              observation("remote-head");
              return Promise.resolve("commit-a");
            },
          },
          restart: {
            request: () => undefined,
            requested: () => {
              observation(`baseline:${String(baseline.get("commit"))}`);
              return "idle";
            },
          },
          idleMonitor: {
            recordActivity: () => {
              observation("activity");
            },
            idleTooLong: () => false,
          },
          baseline,
        });
        return observation;
      })
      .extend("releasedSignalListeners", async () => {
        const processOff = vi.spyOn(process, "off");
        await cycleUntilStopped({
          mode: "reviewer",
          runtime: {
            log: silentLogger,
            syncToMain: () => Promise.resolve(),
            drainStartup: () => Promise.resolve([]),
            connect: () => Promise.resolve(),
            subscribe: async function* subscribe() {
              await Promise.resolve();
              yield* [];
            },
            dispatcher: { dispatch: () => true },
            queue: {
              enqueue: () => true,
              enqueueFollowUp: () => true,
              setHandlers: () => undefined,
              runningLanes: () => [],
              waitingLanes: () => [],
              size: () => ({ waiting: 0, running: 0 }),
              isIdle: () => true,
              admitsLane: () => true,
              cancelLane: () => 0,
              drain: () => Promise.resolve(),
              reserveLane: () => Promise.resolve(null),
            },
            disconnect: () => undefined,
            remoteHeadCommit: () => Promise.resolve("commit-a"),
          },
          restart: { request: () => undefined, requested: () => "idle" },
          idleMonitor: { recordActivity: () => undefined, idleTooLong: () => false },
          baseline: new Map(),
        });
        return processOff;
      });

    it("remote head を最初に読む", ({ immediateCycleObservation }) => {
      expect(immediateCycleObservation).toHaveBeenNthCalledWith(1, "remote-head");
    });

    it("main へ同期する", ({ immediateCycleObservation }) => {
      expect(immediateCycleObservation).toHaveBeenNthCalledWith(2, "sync-main");
    });

    it("起動時イベントを巻き取る", ({ immediateCycleObservation }) => {
      expect(immediateCycleObservation).toHaveBeenNthCalledWith(3, "startup-drain");
    });

    it("relay へ接続する", ({ immediateCycleObservation }) => {
      expect(immediateCycleObservation).toHaveBeenNthCalledWith(4, "connect");
    });

    it("relay を購読する", ({ immediateCycleObservation }) => {
      expect(immediateCycleObservation).toHaveBeenNthCalledWith(5, "subscribe");
    });

    it("購読イベントを活動として記録する", ({ immediateCycleObservation }) => {
      expect(immediateCycleObservation).toHaveBeenNthCalledWith(6, "activity");
    });

    it("再起動判定より前に remote head を基準へ保存する", ({ immediateCycleObservation }) => {
      expect(immediateCycleObservation).toHaveBeenNthCalledWith(7, "baseline:commit-a");
    });

    it("再起動要求を検出したサイクルは追加処理をしない", ({ immediateCycleObservation }) => {
      expect(immediateCycleObservation).toHaveBeenCalledTimes(7);
    });

    it("終了時に両シグナルの登録を解放する", ({ releasedSignalListeners }) => {
      expect(releasedSignalListeners).toHaveBeenCalledTimes(2);
    });
  });

  describe("stream 終了後の再接続", () => {
    const it = test.extend("reconnectObservation", async ({}, { onCleanup }) => {
      vi.useFakeTimers();
      onCleanup(() => {
        vi.useRealTimers();
      });
      const observation = vi.fn<(event: string) => void>();
      const warningObserved = Promise.withResolvers<undefined>();
      const requested = vi
        .fn<() => "idle" | null>()
        .mockReturnValueOnce(null)
        .mockReturnValue("idle");
      const completion = cycleUntilStopped({
        mode: "reviewer",
        runtime: {
          log: {
            ...silentLogger,
            warn: (fields, logText) => {
              observation(`${String(fields.ending)}|${logText}`);
              warningObserved.resolve(undefined);
            },
          },
          syncToMain: () => Promise.resolve(),
          drainStartup: () => Promise.resolve([]),
          connect: () => Promise.resolve(),
          subscribe: async function* subscribe() {
            await Promise.resolve();
            yield* [];
          },
          dispatcher: { dispatch: () => true },
          queue: {
            enqueue: () => true,
            enqueueFollowUp: () => true,
            setHandlers: () => undefined,
            runningLanes: () => [],
            waitingLanes: () => [],
            size: () => ({ waiting: 0, running: 0 }),
            isIdle: () => true,
            admitsLane: () => true,
            cancelLane: () => 0,
            drain: () => Promise.resolve(),
            reserveLane: () => Promise.resolve(null),
          },
          disconnect: () => undefined,
          remoteHeadCommit: () => {
            observation("remote-head");
            return Promise.resolve("commit-b");
          },
        },
        restart: { request: () => undefined, requested },
        idleMonitor: { recordActivity: () => undefined, idleTooLong: () => false },
        baseline: new Map(),
      });
      await warningObserved.promise;
      await vi.advanceTimersByTimeAsync(3_000);
      await completion;
      return observation;
    });

    it("最初の接続を開始する", ({ reconnectObservation }) => {
      expect(reconnectObservation).toHaveBeenNthCalledWith(1, "remote-head");
    });

    it("stream 終了を正確に記録する", ({ reconnectObservation }) => {
      expect(reconnectObservation).toHaveBeenNthCalledWith(
        2,
        "stream-ended|the connection cycle ended; reconnecting shortly",
      );
    });

    it("3 秒後に次の接続を開始する", ({ reconnectObservation }) => {
      expect(reconnectObservation).toHaveBeenNthCalledWith(3, "remote-head");
    });

    it("再接続要求を検出したら繰り返しを終える", ({ reconnectObservation }) => {
      expect(reconnectObservation).toHaveBeenCalledTimes(3);
    });
  });

  describe("remote head が空のときの再試行", () => {
    const it = test.extend("backoffObservation", async ({}, { onCleanup }) => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0);
      onCleanup(() => {
        vi.useRealTimers();
      });
      const observation = vi.fn<(event: string) => void>();
      const firstFailureObserved = Promise.withResolvers<undefined>();
      const secondFailureObserved = Promise.withResolvers<undefined>();
      const remoteHeadCommit = vi
        .fn<() => Promise<string | null>>()
        .mockImplementationOnce(() => {
          observation("remote-1");
          return Promise.resolve(null);
        })
        .mockImplementationOnce(() => {
          observation("remote-2");
          return Promise.resolve(null);
        })
        .mockImplementation(() => {
          observation("remote-3");
          return Promise.resolve("commit-c");
        });
      const completion = cycleUntilStopped({
        mode: "reviewer",
        runtime: {
          log: {
            ...silentLogger,
            error: (fields, logText) => {
              const cycleFailure = fields.err;
              observation(
                [
                  logText,
                  String(fields.backoffMs),
                  String(fields.consecutiveFailures),
                  cycleFailure instanceof Error ? cycleFailure.message : String(cycleFailure),
                ].join("|"),
              );
              if (fields.consecutiveFailures === 1) firstFailureObserved.resolve(undefined);
              if (fields.consecutiveFailures === 2) secondFailureObserved.resolve(undefined);
            },
          },
          syncToMain: () => Promise.resolve(),
          drainStartup: () => Promise.resolve([]),
          connect: () => Promise.resolve(),
          subscribe: async function* subscribe() {
            await Promise.resolve();
            yield* [];
          },
          dispatcher: { dispatch: () => true },
          queue: {
            enqueue: () => true,
            enqueueFollowUp: () => true,
            setHandlers: () => undefined,
            runningLanes: () => [],
            waitingLanes: () => [],
            size: () => ({ waiting: 0, running: 0 }),
            isIdle: () => true,
            admitsLane: () => true,
            cancelLane: () => 0,
            drain: () => Promise.resolve(),
            reserveLane: () => Promise.resolve(null),
          },
          disconnect: () => undefined,
          remoteHeadCommit,
        },
        restart: { request: () => undefined, requested: () => "idle" },
        idleMonitor: { recordActivity: () => undefined, idleTooLong: () => false },
        baseline: new Map(),
      });
      await firstFailureObserved.promise;
      await vi.advanceTimersByTimeAsync(1_500);
      await secondFailureObserved.promise;
      await vi.advanceTimersByTimeAsync(3_000);
      await completion;
      return observation;
    });

    it("最初の remote head を読む", ({ backoffObservation }) => {
      expect(backoffObservation).toHaveBeenNthCalledWith(1, "remote-1");
    });

    it("最初の失敗を 1.5 秒の backoff として記録する", ({ backoffObservation }) => {
      expect(backoffObservation).toHaveBeenNthCalledWith(
        2,
        "the connection cycle failed; retrying after a backoff|1500|1|the tracked remote branch resolved to no commit",
      );
    });

    it("1.5 秒後に remote head を読み直す", ({ backoffObservation }) => {
      expect(backoffObservation).toHaveBeenNthCalledWith(3, "remote-2");
    });

    it("2 回目の失敗を 3 秒の backoff として記録する", ({ backoffObservation }) => {
      expect(backoffObservation).toHaveBeenNthCalledWith(
        4,
        "the connection cycle failed; retrying after a backoff|3000|2|the tracked remote branch resolved to no commit",
      );
    });

    it("3 秒後に remote head を読み直す", ({ backoffObservation }) => {
      expect(backoffObservation).toHaveBeenNthCalledWith(5, "remote-3");
    });

    it("remote head を得たら追加の再試行をしない", ({ backoffObservation }) => {
      expect(backoffObservation).toHaveBeenCalledTimes(5);
    });
  });

  describe("恒久的な資格情報拒否", () => {
    const it = test
      .extend("credentialFailure", async () => {
        const failure = new CredentialTerminalError("refused");
        try {
          await cycleUntilStopped({
            mode: "reviewer",
            runtime: {
              log: silentLogger,
              syncToMain: () => Promise.resolve(),
              drainStartup: () => Promise.resolve([]),
              connect: () => Promise.resolve(),
              subscribe: async function* subscribe() {
                await Promise.resolve();
                yield* [];
              },
              dispatcher: { dispatch: () => true },
              queue: {
                enqueue: () => true,
                enqueueFollowUp: () => true,
                setHandlers: () => undefined,
                runningLanes: () => [],
                waitingLanes: () => [],
                size: () => ({ waiting: 0, running: 0 }),
                isIdle: () => true,
                admitsLane: () => true,
                cancelLane: () => 0,
                drain: () => Promise.resolve(),
                reserveLane: () => Promise.resolve(null),
              },
              disconnect: () => undefined,
              remoteHeadCommit: () => Promise.reject(failure),
            },
            restart: { request: () => undefined, requested: () => null },
            idleMonitor: { recordActivity: () => undefined, idleTooLong: () => false },
            baseline: new Map(),
          });
        } catch (caught) {
          return caught;
        }
        throw new Error("the credential rejection was not propagated");
      })
      .extend("credentialRemoteHead", async () => {
        const failure = new CredentialTerminalError("refused");
        const remoteHeadCommit = vi.fn<() => Promise<string | null>>(() => Promise.reject(failure));
        try {
          await cycleUntilStopped({
            mode: "reviewer",
            runtime: {
              log: silentLogger,
              syncToMain: () => Promise.resolve(),
              drainStartup: () => Promise.resolve([]),
              connect: () => Promise.resolve(),
              subscribe: async function* subscribe() {
                await Promise.resolve();
                yield* [];
              },
              dispatcher: { dispatch: () => true },
              queue: {
                enqueue: () => true,
                enqueueFollowUp: () => true,
                setHandlers: () => undefined,
                runningLanes: () => [],
                waitingLanes: () => [],
                size: () => ({ waiting: 0, running: 0 }),
                isIdle: () => true,
                admitsLane: () => true,
                cancelLane: () => 0,
                drain: () => Promise.resolve(),
                reserveLane: () => Promise.resolve(null),
              },
              disconnect: () => undefined,
              remoteHeadCommit,
            },
            restart: { request: () => undefined, requested: () => null },
            idleMonitor: { recordActivity: () => undefined, idleTooLong: () => false },
            baseline: new Map(),
          });
        } catch (caughtFailure) {
          if (caughtFailure !== failure) throw caughtFailure;
        }
        return remoteHeadCommit;
      })
      .extend("credentialErrorLog", async () => {
        const failure = new CredentialTerminalError("refused");
        const errorLog =
          vi.fn<(fields: Readonly<Record<string, unknown>>, logText: string) => void>();
        try {
          await cycleUntilStopped({
            mode: "reviewer",
            runtime: {
              log: { ...silentLogger, error: errorLog },
              syncToMain: () => Promise.resolve(),
              drainStartup: () => Promise.resolve([]),
              connect: () => Promise.resolve(),
              subscribe: async function* subscribe() {
                await Promise.resolve();
                yield* [];
              },
              dispatcher: { dispatch: () => true },
              queue: {
                enqueue: () => true,
                enqueueFollowUp: () => true,
                setHandlers: () => undefined,
                runningLanes: () => [],
                waitingLanes: () => [],
                size: () => ({ waiting: 0, running: 0 }),
                isIdle: () => true,
                admitsLane: () => true,
                cancelLane: () => 0,
                drain: () => Promise.resolve(),
                reserveLane: () => Promise.resolve(null),
              },
              disconnect: () => undefined,
              remoteHeadCommit: () => Promise.reject(failure),
            },
            restart: { request: () => undefined, requested: () => null },
            idleMonitor: { recordActivity: () => undefined, idleTooLong: () => false },
            baseline: new Map(),
          });
        } catch (caughtFailure) {
          if (caughtFailure !== failure) throw caughtFailure;
        }
        return errorLog;
      });

    it("資格情報エラーをそのまま伝播する", ({ credentialFailure }) => {
      expect(credentialFailure).toStrictEqual(new CredentialTerminalError("refused"));
    });

    it("資格情報エラーでは remote head を再試行しない", ({ credentialRemoteHead }) => {
      expect(credentialRemoteHead).toHaveBeenCalledTimes(1);
    });

    it("資格情報エラーを再試行ログへ記録しない", ({ credentialErrorLog }) => {
      expect(credentialErrorLog).toHaveBeenCalledTimes(0);
    });
  });

  describe("shutdown signal", () => {
    const it = test.extend("signalDisconnect", async ({}, { onCleanup }) => {
      const priorListeners = new Set(process.listeners("SIGTERM"));
      onCleanup(() => {
        for (const listener of process.listeners("SIGTERM")) {
          if (!priorListeners.has(listener)) process.off("SIGTERM", listener);
        }
      });
      const streamMayFinish = Promise.withResolvers<undefined>();
      const disconnect = vi.fn<() => void>();
      const completion = cycleUntilStopped({
        mode: "reviewer",
        runtime: {
          log: silentLogger,
          syncToMain: () => Promise.resolve(),
          drainStartup: () => Promise.resolve([]),
          connect: () => Promise.resolve(),
          subscribe: async function* subscribe() {
            await streamMayFinish.promise;
            yield {};
          },
          dispatcher: { dispatch: () => true },
          queue: {
            enqueue: () => true,
            enqueueFollowUp: () => true,
            setHandlers: () => undefined,
            runningLanes: () => [],
            waitingLanes: () => [],
            size: () => ({ waiting: 0, running: 0 }),
            isIdle: () => true,
            admitsLane: () => true,
            cancelLane: () => 0,
            drain: () => Promise.resolve(),
            reserveLane: () => Promise.resolve(null),
          },
          disconnect,
          remoteHeadCommit: () => Promise.resolve("commit-d"),
        },
        restart: { request: () => undefined, requested: () => null },
        idleMonitor: { recordActivity: () => undefined, idleTooLong: () => false },
        baseline: new Map(),
      });
      const signalListener = process
        .listeners("SIGTERM")
        .find((listener) => !priorListeners.has(listener));
      if (signalListener === undefined) throw new Error("SIGTERM listener was not registered");
      signalListener("SIGTERM");
      streamMayFinish.resolve(undefined);
      await completion;
      return disconnect;
    });

    it("signal を受けたら relay を切断する", ({ signalDisconnect }) => {
      expect(signalDisconnect).toHaveBeenCalledExactlyOnceWith();
    });
  });
});
