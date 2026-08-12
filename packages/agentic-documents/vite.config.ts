import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"],
      thresholds: { 100: true, perFile: true },
    },
  },
  pack: {
    entry: ["src/cli.ts"],
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
      exclude: ["cli"],
      bin: {
        "agentic-documents": "src/cli.ts",
      },
      customExports: {
        "./package.json": "./package.json",
      },
    },
  },
});
