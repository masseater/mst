import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/cli.ts", "src/index.ts", "src/plugin.ts"],
    dts: {
      tsgo: true,
    },
  },
});
