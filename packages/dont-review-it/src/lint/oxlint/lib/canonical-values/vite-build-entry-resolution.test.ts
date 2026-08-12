import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { STRICT_RULE } from "../../rules/canonical-literal-rule-test-fixture.ts";

const repository = (name: string, files: Readonly<Record<string, string>>): string => {
  const root = join(tmpdir(), `canonical-value-vite-entry-${name}-${randomUUID()}`);
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = join(root, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents, "utf8");
  }
  process.once("exit", () => {
    rmSync(root, { force: true, recursive: true });
  });
  return root;
};

const OUT_OF_SCOPE_CONFIG = `import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

const libraryEntries = [resolve(import.meta.dirname, "fixtures/status.ts")];
const input = { main: resolve(import.meta.dirname, "fixtures/main.html") };

export default defineConfig(() => ({
  build: {
    lib: { entry: libraryEntries },
    rollupOptions: { input },
    ssr: resolve(import.meta.dirname, "fixtures/server.ts"),
  },
}));
`;

const PRODUCTION_CONFIG = `import { resolve } from "node:path";

export default {
  build: { lib: { entry: resolve(import.meta.dirname, "src/main.ts") } },
};
`;

const UNKNOWN_SHAPE_CONFIG = `import { resolve } from "node:path";

declare const section: string;
export default {
  [section]: { lib: { entry: resolve(import.meta.dirname, "fixtures/status.ts") } },
};
`;

const MERGED_CONFIG = `import { resolve } from "node:path";
import { mergeConfig } from "vite";

export default mergeConfig({}, {
  build: { lib: { entry: resolve(import.meta.dirname, "fixtures/status.ts") } },
});
`;

const OUT_OF_SCOPE_ROOT = repository("out-of-scope", {
  "fixtures/main.html": "<main></main>\n",
  "fixtures/server.ts": "export const server = true;\n",
  "fixtures/status.ts": "export const status = true;\n",
  "package.json": JSON.stringify({ private: true }),
  "vite.config.ts": OUT_OF_SCOPE_CONFIG,
});

const PRODUCTION_ROOT = repository("production", {
  "package.json": JSON.stringify({ private: true }),
  "src/main.ts": "export const main = true;\n",
  "vite.config.ts": PRODUCTION_CONFIG,
});

const UNKNOWN_SHAPE_ROOT = repository("unknown-shape", {
  "fixtures/status.ts": "export const status = true;\n",
  "package.json": JSON.stringify({ private: true }),
  "vite.config.ts": UNKNOWN_SHAPE_CONFIG,
});

const MERGED_ROOT = repository("merged", {
  "fixtures/status.ts": "export const status = true;\n",
  "package.json": JSON.stringify({ private: true }),
  "vite.config.ts": MERGED_CONFIG,
});

describe("out-of-scope Vite build entries", () => {
  testLintRule(STRICT_RULE, {
    valid: [
      {
        name: "a production build entry remains in the inspected source set",
        code: PRODUCTION_CONFIG,
        cwd: PRODUCTION_ROOT,
        filename: join(PRODUCTION_ROOT, "vite.config.ts"),
      },
    ],
    invalid: [
      {
        name: "Vite cannot execute fixture lib Rollup or SSR entries",
        code: OUT_OF_SCOPE_CONFIG,
        cwd: OUT_OF_SCOPE_ROOT,
        filename: join(OUT_OF_SCOPE_ROOT, "vite.config.ts"),
        errors: [
          { messageId: "productionImportsOutOfScopeSource" },
          { messageId: "productionImportsOutOfScopeSource" },
          { messageId: "productionImportsOutOfScopeSource" },
        ],
      },
      {
        name: "an unresolved config property cannot hide a build entry",
        code: UNKNOWN_SHAPE_CONFIG,
        cwd: UNKNOWN_SHAPE_ROOT,
        filename: join(UNKNOWN_SHAPE_ROOT, "vite.config.ts"),
        errors: [{ messageId: "productionImportsOutOfScopeSource" }],
      },
      {
        name: "an unresolved merged config cannot hide a build entry",
        code: MERGED_CONFIG,
        cwd: MERGED_ROOT,
        filename: join(MERGED_ROOT, "vite.config.ts"),
        errors: [{ messageId: "productionImportsOutOfScopeSource" }],
      },
    ],
  });
});
