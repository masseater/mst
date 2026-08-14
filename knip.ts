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
    "packages/stop-ai-slop": {
      project: ["src/**/*.ts!", "!src/check-test-repository.ts!", "!src/test-repository.ts!"],
    },
  },
} satisfies KnipConfig;
