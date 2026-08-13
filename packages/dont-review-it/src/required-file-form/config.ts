export type ToolConfigFormats = {
  readonly toolName: string;
  readonly typeScriptFileName: string;
  readonly foreignFileNames: readonly string[];
};

export type RequiredFileFormConfig = {
  readonly tools: readonly ToolConfigFormats[];
  readonly agentInstructionFileName: string;
  readonly linkedAgentInstructionFileName: string;
};

export const defaultRequiredFileFormConfig: RequiredFileFormConfig = {
  tools: [
    {
      toolName: "knip",
      typeScriptFileName: "knip.ts",
      foreignFileNames: [
        "knip.json",
        "knip.jsonc",
        ".knip.json",
        ".knip.jsonc",
        "knip.js",
        "knip.config.js",
      ],
    },
    {
      toolName: "oxlint",
      typeScriptFileName: "vite.config.ts",
      foreignFileNames: [".oxlintrc.json", ".oxlintrc.jsonc"],
    },
    {
      toolName: "eslint",
      typeScriptFileName: "eslint.config.ts",
      foreignFileNames: [
        "eslint.config.js",
        "eslint.config.mjs",
        "eslint.config.cjs",
        ".eslintrc.js",
        ".eslintrc.cjs",
        ".eslintrc.yaml",
        ".eslintrc.yml",
        ".eslintrc.json",
      ],
    },
    {
      toolName: "vite",
      typeScriptFileName: "vite.config.ts",
      foreignFileNames: ["vite.config.js", "vite.config.mjs", "vite.config.cjs"],
    },
  ],
  agentInstructionFileName: "AGENTS.md",
  linkedAgentInstructionFileName: "CLAUDE.md",
};
