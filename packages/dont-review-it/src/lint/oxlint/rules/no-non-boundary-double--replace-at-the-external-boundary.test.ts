import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { createNoNonBoundaryDouble } from "./no-non-boundary-double--replace-at-the-external-boundary.ts";

const outsideRule = createNoNonBoundaryDouble({
  readBoundary: () => ({ kind: "outsideTheRepository" }),
});

const boundaryRule = createNoNonBoundaryDouble({
  readBoundary: () => ({ kind: "ownsExternalIo" }),
});

const determinedRule = createNoNonBoundaryDouble({
  readBoundary: () => ({ kind: "determinedByItsInput" }),
});

const insideRule = createNoNonBoundaryDouble({
  readBoundary: () => ({
    kind: "behindOwnModules",
    boundary: "packages/mailer/src/transport.ts",
  }),
});

const SPEC_FILE = "packages/mailer/src/send.test.ts";

describe("dont-review-it/no-non-boundary-double--replace-at-the-external-boundary", () => {
  testLintRule(outsideRule, {
    valid: [
      {
        name: "a module that lives outside this repository is a boundary the spec may take",
        code: "vi.mock('node:child_process');",
        filename: SPEC_FILE,
      },
      {
        name: "a file that is not a spec is never looked at",
        code: "vi.mock('./transport.ts');",
        filename: "packages/mailer/src/send.ts",
      },
      {
        name: "a call that names no module cannot be a replacement",
        code: "vi.mock();",
        filename: SPEC_FILE,
      },
      {
        name: "a module handed over as a spread cannot be read",
        code: "vi.mock(...declared);",
        filename: SPEC_FILE,
      },
      {
        name: "a module assembled at run time cannot be read",
        code: "vi.mock(chosen);",
        filename: SPEC_FILE,
      },
      {
        name: "another member of the runner is not a module replacement",
        code: "vi.mocked(transport);",
        filename: SPEC_FILE,
      },
      {
        name: "a member reached through a computed name is not read as the member",
        code: "vi['mock']('./transport.ts');",
        filename: SPEC_FILE,
      },
      {
        name: "the same member on something that is not the runner is a different call",
        code: "helpers.mock('./transport.ts');",
        filename: SPEC_FILE,
      },
      {
        name: "a bare call is not a member call",
        code: "mock('./transport.ts');",
        filename: SPEC_FILE,
      },
    ],
    invalid: [],
  });

  testLintRule(boundaryRule, {
    valid: [
      {
        name: "a module that owns the boundary itself is the place to replace",
        code: "vi.mock('./transport.ts');",
        filename: SPEC_FILE,
      },
    ],
    invalid: [],
  });

  testLintRule(determinedRule, {
    valid: [],
    invalid: [
      {
        name: "a module whose output is determined by its input is reported",
        code: "vi.mock('./compose.ts');",
        filename: SPEC_FILE,
        errors: [{ messageId: "determinedModuleDouble" }],
      },
      {
        name: "the deferred spelling of the same declaration is reported",
        code: "vi.doMock('./compose.ts');",
        filename: SPEC_FILE,
        errors: [{ messageId: "determinedModuleDouble" }],
      },
      {
        name: "a module named through a dynamic import is the module it names",
        code: "vi.mock(import('./compose.ts'));",
        filename: SPEC_FILE,
        errors: [{ messageId: "determinedModuleDouble" }],
      },
      {
        name: "the runner reached under another name is still the runner",
        code: "import { vi as runner } from 'vitest';\nrunner.mock('./compose.ts');",
        filename: SPEC_FILE,
        errors: [{ messageId: "determinedModuleDouble" }],
      },
    ],
  });

  testLintRule(insideRule, {
    valid: [],
    invalid: [
      {
        name: "a module that reaches the outside only through another module is reported",
        code: "vi.mock('./send.ts');",
        filename: SPEC_FILE,
        errors: [{ messageId: "insideBoundaryDouble" }],
      },
    ],
  });
});
