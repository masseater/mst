import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"],
      thresholds: { 100: true, perFile: true },
    },
  },
  pack: {
    entry: ["src/cli.ts", "src/index.ts"],
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
        "verified-specifications": "src/cli.ts",
      },
      customExports: {
        "./package.json": "./package.json",
      },
    },
  },
});
