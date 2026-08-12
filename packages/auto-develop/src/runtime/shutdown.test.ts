import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { registerShutdown, type ShutdownSignal, type SignalTarget } from "./shutdown.ts";

const recordingTarget = (): {
  readonly target: SignalTarget;
  readonly fire: (signal: ShutdownSignal) => void;
  readonly listenerCount: () => number;
} => {
  const listeners = new Map<ShutdownSignal, Set<() => void>>();
  return {
    target: {
      on: (signal, listener) => {
        const forSignal = listeners.get(signal) ?? new Set<() => void>();
        forSignal.add(listener);
        listeners.set(signal, forSignal);
      },
      off: (signal, listener) => {
        listeners.get(signal)?.delete(listener);
      },
    },
    fire: (signal) => {
      for (const listener of listeners.get(signal) ?? []) listener();
    },
    listenerCount: () => [...listeners.values()].reduce((total, set) => total + set.size, 0),
  };
};

const it = test
  .extend("firedSignals", () => {
    const recording = recordingTarget();
    const onSignal = vi.fn<(signal: ShutdownSignal) => void>();
    registerShutdown({ target: recording.target, onSignal, log: silentLogger });
    recording.fire("SIGINT");
    return onSignal.mock.calls;
  })
  .extend("registeredCount", () => {
    const recording = recordingTarget();
    registerShutdown({ target: recording.target, onSignal: () => undefined, log: silentLogger });
    return recording.listenerCount();
  })
  .extend("countAfterRelease", () => {
    const recording = recordingTarget();
    const registration = registerShutdown({
      target: recording.target,
      onSignal: () => undefined,
      log: silentLogger,
    });
    registration.release();
    return recording.listenerCount();
  })
  .extend("callsAfterRelease", () => {
    const recording = recordingTarget();
    const onSignal = vi.fn<(signal: ShutdownSignal) => void>();
    const registration = registerShutdown({
      target: recording.target,
      onSignal,
      log: silentLogger,
    });
    registration.release();
    recording.fire("SIGTERM");
    return onSignal.mock.calls.length;
  });

describe("registerShutdown", () => {
  it("受け取ったシグナルを通知先へ渡す", ({ firedSignals }) => {
    expect(firedSignals).toStrictEqual([["SIGINT"]]);
  });

  it("停止シグナル 2 種にリスナーを登録する", ({ registeredCount }) => {
    expect(registeredCount).toStrictEqual(2);
  });

  it("解除するとリスナーが残らない", ({ countAfterRelease }) => {
    expect(countAfterRelease).toStrictEqual(0);
  });

  it("解除後のシグナルは通知先を呼ばない", ({ callsAfterRelease }) => {
    expect(callsAfterRelease).toStrictEqual(0);
  });
});
