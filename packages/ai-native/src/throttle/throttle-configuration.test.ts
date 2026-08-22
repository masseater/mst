import { describe, expect, test } from "vite-plus/test";

import { resolveThrottleConfiguration } from "./throttle-configuration.ts";

describe("resolveThrottleConfiguration", () => {
  const it = test.extend("defaultWaitBudgetConfiguration", () =>
    resolveThrottleConfiguration({
      slotDir: "/slots",
      limit: 1,
      pollMs: 1_000,
      isInteractive: false,
    }));

  it("the default wait budget is 1,900,000 milliseconds", ({ defaultWaitBudgetConfiguration }) => {
    expect(defaultWaitBudgetConfiguration).toStrictEqual({
      slotDir: "/slots",
      limit: 1,
      waitBudgetMs: 1_900_000,
      pollMs: 1_000,
      interactive: false,
    });
  });
});
