import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    testTimeout: 15_000,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      thresholds: { 100: true, perFile: true },
    },
  },
  pack: {
    entry: ["src/cli.ts", "src/index.ts", "src/plugin.ts"],
    dts: {
      tsgo: true,
    },
  },
});
