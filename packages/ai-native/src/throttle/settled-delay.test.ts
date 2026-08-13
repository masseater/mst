import { describe, expect, test } from "vite-plus/test";

import { settledDelay } from "./settled-delay.ts";

describe("settledDelay", () => {
  describe("a wait nobody cancels", () => {
    const it = test.extend("uncancelledWaitSettlement", async () =>
      settledDelay(1, new AbortController().signal));

    it("reports the wait as one that ran its course", ({ uncancelledWaitSettlement }) => {
      expect(uncancelledWaitSettlement).toBe("elapsed");
    });
  });

  describe("a wait cancelled while it is still running", () => {
    const it = test.extend("settlementOfWaitCancelledMidflight", async () => {
      const canceller = new AbortController();
      const waiting = settledDelay(30_000, canceller.signal);
      canceller.abort();
      return waiting;
    });

    it("reports the wait as one that never ran its course", ({
      settlementOfWaitCancelledMidflight,
    }) => {
      expect(settlementOfWaitCancelledMidflight).toBe("cancelled");
    });
  });

  describe("a wait handed a signal that was already cancelled", () => {
    const it = test.extend("settlementOfWaitCancelledBeforeItBegan", async () =>
      settledDelay(30_000, AbortSignal.abort()));

    it("reports the wait as one that never ran its course", ({
      settlementOfWaitCancelledBeforeItBegan,
    }) => {
      expect(settlementOfWaitCancelledBeforeItBegan).toBe("cancelled");
    });
  });
});
