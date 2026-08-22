import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    mockReset: true,
    restoreMocks: true,
    fileParallelism: false,
    pool: "threads",
    maxWorkers: 1,
    testTimeout: 60_000,
    coverage: {
      thresholds: { 100: true, perFile: true },
      include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"],
    },
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: ["src/throttle/cli.ts", "src/spool/cli.ts", "src/unabridged/cli.ts"],
    dts: {
      tsgo: true,
    },
    exports: {
      devExports: true,
      exclude: ["spool/cli", "throttle/cli", "unabridged/cli"],
      bin: {
        spool: "src/spool/cli.ts",
        throttle: "src/throttle/cli.ts",
        unabridged: "src/unabridged/cli.ts",
      },
      customExports: {
        "./package.json": "./package.json",
      },
    },
  },
});
