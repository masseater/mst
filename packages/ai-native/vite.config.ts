import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    coverage: {
      thresholds: { 100: true, perFile: true },
      include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"],
    },
  },
  pack: {
    entry: ["src/throttle/cli.ts", "src/spool/cli.ts"],
    dts: {
      tsgo: true,
    },
  },
});
