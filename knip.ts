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
} satisfies KnipConfig;
