import { describe, expect, test } from "vite-plus/test";

import { createIdleMonitor } from "./idle-monitor.ts";

const thresholdMs = 30 * 60_000;

describe("createIdleMonitor", () => {
  const it = test
    .extend("verdictBeforeAnyActivity", () =>
      createIdleMonitor({
        startedAtMs: 0,
        thresholdMs,
        now: () => thresholdMs - 1,
      }).idleTooLong())
    .extend("verdictWithoutActivityPastThreshold", () =>
      createIdleMonitor({
        startedAtMs: 0,
        thresholdMs,
        now: () => thresholdMs,
      }).idleTooLong(),
    )
    .extend("verdictJustAfterActivity", () => {
      const askedMoments = [thresholdMs, thresholdMs * 2 - 1][Symbol.iterator]();
      const monitorAskedJustBeforeThreshold = createIdleMonitor({
        startedAtMs: 0,
        thresholdMs,
        now: () => askedMoments.next().value ?? 0,
      });
      monitorAskedJustBeforeThreshold.recordActivity();
      return monitorAskedJustBeforeThreshold.idleTooLong();
    })
    .extend("verdictLongAfterActivity", () => {
      const askedMoments = [thresholdMs, thresholdMs * 2][Symbol.iterator]();
      const monitorAskedAtThreshold = createIdleMonitor({
        startedAtMs: 0,
        thresholdMs,
        now: () => askedMoments.next().value ?? 0,
      });
      monitorAskedAtThreshold.recordActivity();
      return monitorAskedAtThreshold.idleTooLong();
    });

  it("活動が無いままでも閾値未満なら再起動不要と答える", ({ verdictBeforeAnyActivity }) => {
    expect(verdictBeforeAnyActivity).toStrictEqual(false);
  });

  it("活動が一度も無いまま閾値に達したら再起動が必要と答える", ({
    verdictWithoutActivityPastThreshold,
  }) => {
    expect(verdictWithoutActivityPastThreshold).toStrictEqual(true);
  });

  it("直近の活動から閾値未満なら再起動不要と答える", ({ verdictJustAfterActivity }) => {
    expect(verdictJustAfterActivity).toStrictEqual(false);
  });

  it("直近の活動から閾値ちょうどで再起動が必要と答える", ({ verdictLongAfterActivity }) => {
    expect(verdictLongAfterActivity).toStrictEqual(true);
  });
});
