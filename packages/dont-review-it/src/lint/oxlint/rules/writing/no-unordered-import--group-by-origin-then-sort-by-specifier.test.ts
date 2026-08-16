import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noUnorderedImport } from "./no-unordered-import--group-by-origin-then-sort-by-specifier.ts";

describe("dont-review-it/no-unordered-import--group-by-origin-then-sort-by-specifier", () => {
  testLintRule(noUnorderedImport, {
    valid: [
      {
        name: "a single import has nothing to be ordered against",
        code: 'import { join } from "node:path";',
      },
      {
        name: "the four origins in order, each block separated by one blank line",
        documented: true,
        code: 'import { join } from "node:path";\n\nimport { memoize } from "es-toolkit";\n\nimport { report } from "./report.ts";\n\nimport type { Entry } from "./entry.ts";',
      },
      {
        name: "a block sorted by specifier passes",
        code: 'import { readFileSync } from "node:fs";\nimport { tmpdir } from "node:os";\nimport { basename } from "node:path";',
      },
      {
        name: "modules above this directory sort before modules beside it without a blank line",
        code: 'import { createRule } from "../create-rule.ts";\nimport { report } from "./report.ts";',
      },
      {
        name: "the type-only block keeps installed packages ahead of this repository",
        code: 'import { report } from "./report.ts";\n\nimport type { ESTree } from "@oxlint/plugins";\nimport type { Entry } from "./entry.ts";',
      },
      {
        name: "a side-effect import carries no bindings and is left where its evaluation order puts it",
        documented: true,
        code: 'import "./style.css";\nimport heroImage from "./assets/hero.png";\nimport { report } from "./report.ts";',
      },
      {
        name: "a multi-line import is measured from where it ends",
        code: 'import {\n  basename,\n  join,\n} from "node:path";\n\nimport { memoize } from "es-toolkit";',
      },
      {
        name: "a file without imports has nothing to check",
        code: "export const total = 1;",
      },
    ],
    invalid: [
      {
        name: "an installed package placed above a runtime built-in is reported",
        documented: true,
        code: 'import { memoize } from "es-toolkit";\n\nimport { join } from "node:path";',
        errors: [{ messageId: "originOutOfOrder" }],
      },
      {
        name: "a repository module placed above an installed package is reported",
        code: 'import { report } from "./report.ts";\n\nimport { memoize } from "es-toolkit";',
        errors: [{ messageId: "originOutOfOrder" }],
      },
      {
        name: "a type-only import placed above a value import is reported",
        code: 'import type { Entry } from "./entry.ts";\n\nimport { report } from "./report.ts";',
        errors: [{ messageId: "originOutOfOrder" }],
      },
      {
        name: "an unsorted pair inside one block is reported",
        code: 'import { tmpdir } from "node:os";\nimport { basename } from "node:path";\nimport { readFileSync } from "node:fs";',
        errors: [{ messageId: "specifierOutOfOrder" }],
      },
      {
        name: "two blocks written without a blank line between them are reported",
        documented: true,
        code: 'import { join } from "node:path";\nimport { memoize } from "es-toolkit";',
        errors: [{ messageId: "missingBlankLineBetweenOrigins" }],
      },
      {
        name: "a blank line written inside one block is reported",
        code: 'import { tmpdir } from "node:os";\n\nimport { basename } from "node:path";',
        errors: [{ messageId: "blankLineInsideOrigin" }],
      },
      {
        name: "a type-only block that puts this repository ahead of an installed package is reported",
        code: 'import { report } from "./report.ts";\n\nimport type { Entry } from "./entry.ts";\nimport type { ESTree } from "@oxlint/plugins";',
        errors: [{ messageId: "specifierOutOfOrder" }],
      },
    ],
  });
});
