import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import {
  STREAM_ENDED,
  type ConnectionCycleConfig,
  type CycleOutcome,
  type runConnectionCycle,
} from "../runtime/connection-cycle.ts";
import { CredentialTerminalError } from "../transport/credential-provider.ts";
import { cycleUntilStopped, type CycleLoop } from "./cycle-loop.ts";

import type { Logger } from "../logging/logger.ts";
import type { JobQueue } from "../queue/job-queue.ts";
import type { EventDispatcher } from "../runtime/event-dispatch.ts";
import type { registerShutdown, SignalTarget } from "../runtime/shutdown.ts";

const mocked = vi.hoisted(() => ({
  runConnectionCycle: vi.fn<typeof runConnectionCycle>(),
  registerShutdown: vi.fn<typeof registerShutdown>(),
}));

vi.mock(import("../runtime/connection-cycle.ts"), async (importOriginal) => ({
  ...(await importOriginal()),
  runConnectionCycle: mocked.runConnectionCycle,
}));

vi.mock(import("../runtime/shutdown.ts"), async (importOriginal) => ({
  ...(await importOriginal()),
  registerShutdown: mocked.registerShutdown,
}));

const idleQueue = (): JobQueue => ({
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
});

const fixture = (
  remoteHeadCommit: () => Promise<string | null>,
  onError: Logger["error"] = () => undefined,
) => {
  const log: Logger = {
    info: vi.fn<Logger["info"]>(),
    warn: vi.fn<Logger["warn"]>(),
    error: vi.fn<Logger["error"]>(onError),
  };
  const dispatcher: EventDispatcher = {
    dispatch: vi.fn<EventDispatcher["dispatch"]>(() => true),
  };
  const runtime: CycleLoop["runtime"] = {
    log,
    syncToMain: vi.fn<CycleLoop["runtime"]["syncToMain"]>(() => Promise.resolve()),
    drainStartup: vi.fn<CycleLoop["runtime"]["drainStartup"]>(() => Promise.resolve([])),
    connect: vi.fn<CycleLoop["runtime"]["connect"]>(() => Promise.resolve()),
    subscribe: async function* subscribe() {
      yield* [];
    },
    dispatcher,
    queue: idleQueue(),
    disconnect: vi.fn<CycleLoop["runtime"]["disconnect"]>(),
    remoteHeadCommit,
  };
  const release = vi.fn<() => void>();
  const registered = Promise.withResolvers<{
    readonly target: SignalTarget;
    readonly onSignal: (signal: "SIGINT" | "SIGTERM") => void;
    readonly log: Logger;
  }>();
  mocked.registerShutdown.mockImplementation((registration) => {
    registered.resolve(registration);
    return { release };
  });
  return {
    cycling: {
      mode: "reviewer" as const,
      runtime,
      restart: {
        request: vi.fn<CycleLoop["restart"]["request"]>(),
        requested: vi.fn<CycleLoop["restart"]["requested"]>(() => null),
      },
      idleMonitor: {
        recordActivity: vi.fn<CycleLoop["idleMonitor"]["recordActivity"]>(),
        idleTooLong: vi.fn<CycleLoop["idleMonitor"]["idleTooLong"]>(() => false),
      },
      baseline: new Map<string, string>(),
    },
    log,
    release,
    registered: registered.promise,
  };
};

const resetMocks = (): void => {
  mocked.runConnectionCycle.mockReset();
  mocked.registerShutdown.mockReset();
};

describe("cycleUntilStopped", () => {
  test("接続サイクルへ全境界を渡し、再起動要求なら待たずに終了する", async () => {
    resetMocks();
    const setup = fixture(() => Promise.resolve("commit-a"));
    mocked.runConnectionCycle.mockImplementation(async (config) => {
      await config.syncMain();
      await config.startupDrain();
      const connection = config.connect();
      await config.subscribe().next();
      await connection;
      config.onActivity();
      expect(config.signalled()).toBe(false);
      return "restart-requested";
    });

    await cycleUntilStopped(setup.cycling);

    expect(setup.cycling.baseline.get("commit")).toBe("commit-a");
    expect(setup.cycling.runtime.syncToMain).toHaveBeenCalledExactlyOnceWith();
    expect(setup.cycling.runtime.drainStartup).toHaveBeenCalledExactlyOnceWith();
    expect(setup.cycling.runtime.connect).toHaveBeenCalledExactlyOnceWith();
    expect(setup.cycling.idleMonitor.recordActivity).toHaveBeenCalledExactlyOnceWith();
    expect(setup.release).toHaveBeenCalledExactlyOnceWith();
  });

  test("stream 終了後は 3 秒待って次の接続サイクルへ進む", async () => {
    resetMocks();
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const setup = fixture(() => Promise.resolve("commit-b"));
    const firstCycle = Promise.withResolvers<undefined>();
    mocked.runConnectionCycle
      .mockImplementationOnce(() => {
        firstCycle.resolve(undefined);
        return Promise.resolve(STREAM_ENDED);
      })
      .mockResolvedValueOnce("signalled");

    const completion = cycleUntilStopped(setup.cycling);
    await firstCycle.promise;
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(3_000);
    await completion;

    expect(mocked.runConnectionCycle).toHaveBeenCalledTimes(2);
    expect(setup.log.warn).toHaveBeenCalledExactlyOnceWith(
      { ending: STREAM_ENDED },
      "the connection cycle ended; reconnecting shortly",
    );
    expect(setup.release).toHaveBeenCalledExactlyOnceWith();
  });

  test("remote head が空なら失敗回数に応じたバックオフ後に再試行する", async () => {
    resetMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    onTestFinished(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });
    const firstFailureLogged = Promise.withResolvers<undefined>();
    const secondFailureLogged = Promise.withResolvers<undefined>();
    const failureCount = new Map([["value", 0]]);
    const remoteHeadCommit = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("commit-c");
    const setup = fixture(remoteHeadCommit, () => {
      const count = (failureCount.get("value") ?? 0) + 1;
      failureCount.set("value", count);
      if (count === 1) firstFailureLogged.resolve(undefined);
      else secondFailureLogged.resolve(undefined);
    });
    mocked.runConnectionCycle.mockResolvedValue("signalled");

    const completion = cycleUntilStopped(setup.cycling);
    await firstFailureLogged.promise;
    await vi.advanceTimersByTimeAsync(1_500);
    await secondFailureLogged.promise;
    await vi.advanceTimersByTimeAsync(3_000);
    await completion;

    expect(remoteHeadCommit).toHaveBeenCalledTimes(3);
    expect(setup.log.error).toHaveBeenCalledTimes(2);
    const [firstFields, firstMessage] = vi.mocked(setup.log.error).mock.calls[0] ?? [];
    expect(firstMessage).toBe("the connection cycle failed; retrying after a backoff");
    expect(firstFields).toStrictEqual({
      mode: "reviewer",
      backoffMs: 1_500,
      consecutiveFailures: 1,
      err: firstFields?.err,
    });
    const [secondFields, secondMessage] = vi.mocked(setup.log.error).mock.calls[1] ?? [];
    expect(secondMessage).toBe("the connection cycle failed; retrying after a backoff");
    expect(secondFields).toStrictEqual({
      mode: "reviewer",
      backoffMs: 3_000,
      consecutiveFailures: 2,
      err: secondFields?.err,
    });
    for (const fields of [firstFields, secondFields]) {
      const loggedError = fields?.err;
      expect(loggedError).toBeInstanceOf(Error);
      if (!(loggedError instanceof Error))
        throw new Error("the failure log did not retain the error");
      expect(loggedError.message).toBe("the tracked remote branch resolved to no commit");
    }
    expect(setup.release).toHaveBeenCalledExactlyOnceWith();
  });

  test("恒久的な資格情報拒否は再試行せず伝播する", async () => {
    resetMocks();
    const failure = new CredentialTerminalError("refused");
    const setup = fixture(() => Promise.reject(failure));

    await expect(cycleUntilStopped(setup.cycling)).rejects.toBe(failure);

    expect(mocked.runConnectionCycle).not.toHaveBeenCalled();
    expect(setup.log.error).not.toHaveBeenCalled();
    expect(setup.release).toHaveBeenCalledExactlyOnceWith();
  });

  test("shutdown signal は切断してサイクルへ通知し、終了後に登録を解放する", async () => {
    resetMocks();
    const setup = fixture(() => Promise.resolve("commit-d"));
    const cycleStarted = Promise.withResolvers<ConnectionCycleConfig>();
    const cycleEnding = Promise.withResolvers<CycleOutcome>();
    mocked.runConnectionCycle.mockImplementation((config) => {
      cycleStarted.resolve(config);
      return cycleEnding.promise;
    });

    const completion = cycleUntilStopped(setup.cycling);
    const [registration, config] = await Promise.all([setup.registered, cycleStarted.promise]);
    expect(registration.target).toBe(process);
    expect(config.signalled()).toBe(false);

    registration.onSignal("SIGTERM");
    expect(setup.cycling.runtime.disconnect).toHaveBeenCalledExactlyOnceWith();
    expect(config.signalled()).toBe(true);
    cycleEnding.resolve("signalled");
    await completion;

    expect(setup.release).toHaveBeenCalledExactlyOnceWith();
  });
});
