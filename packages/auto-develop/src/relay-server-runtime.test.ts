import { describe, expect, test, vi } from "vite-plus/test";

import { productionRelayServerRuntime } from "./relay-server-runtime.ts";

describe("productionRelayServerRuntime", () => {
  const it = test
    .extend("productionRuntime", () => productionRelayServerRuntime())
    .extend("productionCurrentDirectory", () => productionRelayServerRuntime().currentDirectory())
    .extend("productionCurrentIso", ({}, { onCleanup }) => {
      vi.useFakeTimers();
      onCleanup(() => {
        vi.useRealTimers();
      });
      vi.setSystemTime(new Date("2026-08-13T00:00:00.000Z"));
      return productionRelayServerRuntime().nowIso();
    });

  it("本番 relay runtime は現在の Node 境界を全て公開する", ({ productionRuntime }) => {
    expect(productionRuntime).toStrictEqual({
      environment: process.env,
      currentDirectory: productionRuntime.currentDirectory,
      nowIso: productionRuntime.nowIso,
      fetchImpl: fetch,
      signalTarget: process,
      stdout: productionRuntime.stdout,
      stderr: productionRuntime.stderr,
      exit: productionRuntime.exit,
      createGithubReader: productionRuntime.createGithubReader,
      createLogFileSink: productionRuntime.createLogFileSink,
      createRelay: productionRuntime.createRelay,
    });
  });

  it("本番 relay runtime は現在の作業directoryを返す", ({ productionCurrentDirectory }) => {
    expect(productionCurrentDirectory).toBe(process.cwd());
  });

  it("本番 relay runtime は現在時刻をISO形式で返す", ({ productionCurrentIso }) => {
    expect(productionCurrentIso).toBe("2026-08-13T00:00:00.000Z");
  });
});
