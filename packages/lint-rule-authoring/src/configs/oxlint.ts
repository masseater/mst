import { defineConfig } from "oxlint";

export const oxlint = defineConfig({
  jsPlugins: [{ name: "lint-rule-authoring", specifier: "@mst/lint-rule-authoring/plugin" }],
  rules: {},
});
