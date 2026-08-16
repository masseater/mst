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
    testTimeout: 15_000,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { 100: true, perFile: true },
    },
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: ["src/cli.ts", "src/index.ts", "src/plugin.ts", "src/vitest/standard-io-test.ts"],
    external: [/^vite-plus/],
    dts: {
      tsgo: true,
    },
  },
});
