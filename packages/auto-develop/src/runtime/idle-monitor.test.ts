import { describe, expect, test } from "vite-plus/test";

import { createIdleMonitor } from "./idle-monitor.ts";

const thresholdMs = 30 * 60_000;

const verdictAt = (elapsing: {
  readonly activityAtMs?: number;
  readonly askedAtMs: number;
}): boolean => {
  const clock = new Map([["nowMs", elapsing.activityAtMs ?? 0]]);
  const monitor = createIdleMonitor({
    startedAtMs: 0,
    thresholdMs,
    now: () => clock.get("nowMs") ?? 0,
  });
  if (elapsing.activityAtMs !== undefined) monitor.recordActivity();
  clock.set("nowMs", elapsing.askedAtMs);
  return monitor.idleTooLong();
};

const it = test
  .extend("verdictBeforeAnyActivity", () => verdictAt({ askedAtMs: thresholdMs - 1 }))
  .extend("verdictWithoutActivityPastThreshold", () => verdictAt({ askedAtMs: thresholdMs }))
  .extend("verdictJustAfterActivity", () =>
    verdictAt({ activityAtMs: thresholdMs, askedAtMs: thresholdMs * 2 - 1 }),
  )
  .extend("verdictLongAfterActivity", () =>
    verdictAt({ activityAtMs: thresholdMs, askedAtMs: thresholdMs * 2 }),
  );

describe("createIdleMonitor", () => {
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
