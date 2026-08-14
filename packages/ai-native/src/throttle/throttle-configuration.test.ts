import { describe, expect, test } from "vite-plus/test";

import { resolveThrottleConfiguration } from "./throttle-configuration.ts";

describe("resolveThrottleConfiguration", () => {
  test("the default wait budget is 1,900,000 milliseconds", () => {
    expect(resolveThrottleConfiguration({}).waitBudgetMs).toBe(1_900_000);
  });
});
