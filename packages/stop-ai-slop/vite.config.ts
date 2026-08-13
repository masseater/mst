import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    mockReset: true,
    restoreMocks: true,
    fileParallelism: false,
    testTimeout: 60_000,
    coverage: {
      thresholds: { 100: true, perFile: true },
    },
  },
  pack: {
    entry: ["src/cli.ts"],
    dts: {
      tsgo: true,
    },
  },
});
