import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    experimental: {
      openTelemetry: {
        enabled: process.env.MST_TELEMETRY !== undefined,
        sdkPath: fileURLToPath(import.meta.resolve("@mst/ai-native/vitest-sdk")),
      },
    },
    mockReset: true,
    restoreMocks: true,
    fileParallelism: false,
    pool: "threads",
    maxWorkers: 1,
    testTimeout: 60_000,
    coverage: {
      thresholds: { 100: true, perFile: true },
    },
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: [
      "src/throttle/cli.ts",
      "src/spool/cli.ts",
      "src/unabridged/cli.ts",
      "src/telemetry/telemetry.ts",
    ],
    dts: {
      tsgo: true,
    },
  },
});
