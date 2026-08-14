import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { buildStyleClassIndex } from "../lib/style-classes/class-index.ts";
import { createNoUnusedStyleClass } from "./no-unused-style-class--delete-or-reference-it.ts";

const repositoryRoot = findWorkspaceRoot(process.cwd());

const subjectFilename = join(repositoryRoot, "apps/website/src/main.ts");

const rule = createNoUnusedStyleClass({
  loadIndex: () =>
    buildStyleClassIndex({
      styleSheets: [
        {
          relativePath: "apps/website/src/style.css",
          source: ".orphan {\n  color: red;\n}\n",
        },
      ],
      referenceTexts: [],
    }),
});

describe("dont-review-it/no-unused-style-class--delete-or-reference-it", () => {
  testLintRule(rule, {
    valid: [
      {
        name: "an import of a module the index holds no unused class for is left alone",
        documented: true,
        code: `import { setupCounter } from "./counter.ts";`,
        filename: subjectFilename,
      },
    ],
    invalid: [
      {
        name: "an import of a style sheet that defines a class nothing spells is reported",
        documented: true,
        code: `import "./style.css";`,
        filename: subjectFilename,
        errors: [{ messageId: "unusedStyleClass" }],
      },
    ],
  });
});
