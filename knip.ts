import type { KnipConfig } from "knip";

export default {
  includeEntryExports: true,
  ignoreBinaries: ["mkfifo"],
  ignoreDependencies: [
    "vite",
    "@mst/agentic-documents",
    "@mst/lint-rule-authoring",
    "@mst/stop-ai-slop",
    "@mst/verified-specifications",
  ],
  workspaces: {
    "packages/ai-native": {
      ignore: ["src/telemetry/vitest-sdk.ts"],
    },
    "packages/stop-ai-slop": {
      project: ["src/**/*.ts!", "!src/check-test-repository.ts!", "!src/test-repository.ts!"],
    },
  },
} satisfies KnipConfig;
