import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    fileParallelism: false,
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
    entry: ["src/cli.ts", "src/server.ts"],
    deps: {
      alwaysBundle: ["@mst/repository-checks"],
      dts: {
        alwaysBundle: ["@mst/repository-checks"],
      },
    },
    dts: {
      tsgo: true,
    },
    exports: {
      devExports: true,
      exclude: ["cli", "server"],
      bin: {
        "auto-develop": "src/cli.ts",
        "auto-develop-relay": "src/server.ts",
      },
      customExports: (generatedExports, { isPublish }) => ({
        ...generatedExports,
        "./server": isPublish ? "./dist/server.mjs" : "./src/server.ts",
      }),
    },
  },
});
