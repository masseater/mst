import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 15_000,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"],
      thresholds: { 100: true, perFile: true },
    },
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: {
      cli: "src/cli.ts",
      index: "src/index.ts",
      plugin: "src/plugin.ts",
      vitest: "src/vitest/standard-io-test.ts",
    },
    deps: {
      alwaysBundle: ["@mst/repository-checks"],
      neverBundle: ["vite-plus"],
      dts: {
        alwaysBundle: ["@mst/repository-checks"],
        neverBundle: ["vite-plus"],
      },
    },
    dts: {
      tsgo: true,
    },
    exports: {
      devExports: true,
      exclude: ["cli"],
      bin: {
        "dont-review-it": "src/cli.ts",
      },
      customExports: {
        "./package.json": "./package.json",
        "./tsconfig/*": "./tsconfig/*",
      },
    },
  },
});
