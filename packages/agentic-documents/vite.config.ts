import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    coverage: {
      thresholds: { 100: true, perFile: true },
    },
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: ["src/cli.ts"],
    dts: {
      tsgo: true,
    },
  },
});
