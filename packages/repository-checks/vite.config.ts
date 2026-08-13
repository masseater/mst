import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    mockReset: true,
    restoreMocks: true,
    coverage: {
      thresholds: { 100: true, perFile: true },
    },
  },
  pack: {
    entry: ["src/index.ts"],
    dts: {
      tsgo: true,
    },
  },
});
