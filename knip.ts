import type { KnipConfig } from "knip";

export default {
  includeEntryExports: true,
  ignoreBinaries: ["mkfifo"],
  ignoreDependencies: [
    "vite",
    "@mst/agentic-documents",
    "@mst/stop-ai-slop",
    "@mst/verified-specifications",
  ],
  workspaces: {
    "packages/agentic-documents": {
      ignoreDependencies: ["@mst/ai-native", "@opentelemetry/api"],
    },
    "packages/ai-native": {
      ignore: ["src/telemetry/vitest-sdk.ts"],
    },
    "packages/dont-review-it": {
      ignoreDependencies: ["@mst/ai-native", "@opentelemetry/api"],
    },
    "packages/stop-ai-slop": {
      project: ["src/**/*.ts!", "!src/check-test-repository.ts!", "!src/test-repository.ts!"],
      ignoreDependencies: ["@mst/ai-native", "@opentelemetry/api"],
    },
    "packages/verified-specifications": {
      ignoreDependencies: ["@mst/ai-native", "@opentelemetry/api"],
    },
  },
} satisfies KnipConfig;
