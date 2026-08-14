import { describe, expect, expectTypeOf, onTestFinished, test, vi } from "vite-plus/test";

import { productionRelayServerRuntime, type RelayServerRuntime } from "./relay-server-runtime.ts";

describe("productionRelayServerRuntime", () => {
  test("本番relay runtimeは現在のNode境界と時刻を公開する", () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    vi.setSystemTime(new Date("2026-08-13T00:00:00.000Z"));

    const runtime = productionRelayServerRuntime();

    expectTypeOf<RelayServerRuntime["stdout"]>().toEqualTypeOf<{
      readonly write: (text: string) => unknown;
    }>();
    expect(runtime.environment).toBe(process.env);
    expect(runtime.currentDirectory()).toBe(process.cwd());
    expect(runtime.nowIso()).toBe("2026-08-13T00:00:00.000Z");
    expect(runtime.fetchImpl).toBe(fetch);
    expect(runtime.signalTarget).toBe(process);
    expect(runtime.stdout.write).toBeTypeOf("function");
    expect(runtime.stderr.write).toBeTypeOf("function");
    expect(runtime.exit).toBeTypeOf("function");
    expect(runtime.createGithubReader).toBeTypeOf("function");
    expect(runtime.createLogFileSink).toBeTypeOf("function");
    expect(runtime.createRelay).toBeTypeOf("function");
  });
});
