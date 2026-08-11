import { describe, expect, test } from "vite-plus/test";

import { silentLogger } from "./logger.ts";

describe("silentLogger", () => {
  test("info と warn と error を呼び出しても何も起きない", () => {
    silentLogger.info({ prNumber: 7 }, "accepted");
    silentLogger.warn({ prNumber: 7 }, "delete failed");
    silentLogger.error({ prNumber: 7 }, "stream stopped");
    expect(Object.keys(silentLogger)).toStrictEqual(["info", "warn", "error"]);
  });
});
