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
    dts: {
      tsgo: true,
    },
  },
});
