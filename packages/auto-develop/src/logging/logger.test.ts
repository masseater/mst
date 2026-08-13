import { describe, expect, test } from "vite-plus/test";

import { silentLogger } from "./logger.ts";

describe("silentLogger", () => {
  const it = test.extend("silentLoggerKeysAfterCalls", () => {
    silentLogger.info({ prNumber: 7 }, "accepted");
    silentLogger.warn({ prNumber: 7 }, "delete failed");
    silentLogger.error({ prNumber: 7 }, "stream stopped");
    return Object.keys(silentLogger);
  });

  it("info と warn と error を呼び出しても何も起きない", ({ silentLoggerKeysAfterCalls }) => {
    expect(silentLoggerKeysAfterCalls).toStrictEqual(["info", "warn", "error"]);
  });
});
