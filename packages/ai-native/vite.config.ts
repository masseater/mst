import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    fileParallelism: false,
    pool: "threads",
    maxWorkers: 1,
    testTimeout: 60_000,
    coverage: {
      thresholds: { 100: true, perFile: true },
    },
  },
  pack: {
    entry: ["src/throttle/cli.ts", "src/spool/cli.ts"],
    dts: {
      tsgo: true,
    },
  },
});
