import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    coverage: {
      thresholds: { 100: true, perFile: true },
    },
  },
  pack: {
    dts: {
      tsgo: true,
    },
    exports: true,
  },
});
