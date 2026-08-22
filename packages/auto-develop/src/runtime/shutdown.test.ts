import { EventEmitter } from "node:events";

import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { registerShutdown, type ShutdownSignal } from "./shutdown.ts";

describe("registerShutdown", () => {
  describe("シグナル源に登録した直後", () => {
    const it = test
      .extend("shutdownNotifierReachedByAnInterrupt", () => {
        const signalSource = new EventEmitter();
        const onSignal = vi.fn<(signal: ShutdownSignal) => void>();
        registerShutdown({ target: signalSource, onSignal, log: silentLogger });
        signalSource.emit("SIGINT");
        return onSignal;
      })
      .extend("signalsCarryingListeners", () => {
        const signalSource = new EventEmitter();
        registerShutdown({ target: signalSource, onSignal: () => undefined, log: silentLogger });
        return signalSource.eventNames();
      });

    it("受け取ったシグナルを通知先へ渡す", ({ shutdownNotifierReachedByAnInterrupt }) => {
      expect(shutdownNotifierReachedByAnInterrupt).toHaveBeenCalledWith("SIGINT");
    });

    it("停止シグナル 2 種にリスナーを登録する", ({ signalsCarryingListeners }) => {
      expect(signalsCarryingListeners).toStrictEqual(["SIGINT", "SIGTERM"]);
    });
  });

  describe("登録を解除した後", () => {
    const it = test
      .extend("signalsCarryingListenersAfterRelease", () => {
        const signalSource = new EventEmitter();
        const shutdown = registerShutdown({
          target: signalSource,
          onSignal: () => undefined,
          log: silentLogger,
        });
        shutdown.release();
        return signalSource.eventNames();
      })
      .extend("shutdownNotifierReachedByATerminationAfterRelease", () => {
        const signalSource = new EventEmitter();
        const onSignal = vi.fn<(signal: ShutdownSignal) => void>();
        const shutdown = registerShutdown({ target: signalSource, onSignal, log: silentLogger });
        shutdown.release();
        signalSource.emit("SIGTERM");
        return onSignal;
      });

    it("解除するとリスナーが残らない", ({ signalsCarryingListenersAfterRelease }) => {
      expect(signalsCarryingListenersAfterRelease).toStrictEqual([]);
    });

    it("解除後のシグナルは通知先を呼ばない", ({
      shutdownNotifierReachedByATerminationAfterRelease,
    }) => {
      expect(shutdownNotifierReachedByATerminationAfterRelease).not.toHaveBeenCalled();
    });
  });
});
