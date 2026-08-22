import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { createNoClassAsMutableCell } from "./no-class-as-mutable-cell--decide-in-an-iife.ts";

import type { CellClassIndex } from "../lib/mutable-cell-classes/cell-class-index.ts";

const repositoryRoot = findWorkspaceRoot(process.cwd());

const SUBJECT_PATH = "packages/dont-review-it/src/subject.ts";

const subjectFilename = join(repositoryRoot, SUBJECT_PATH);

const TALLY = `class Tally {
  total = 0;
  add(row: number) {
    this.total += row;
  }
}
`;

const namedScopeRule = createNoClassAsMutableCell({
  loadIndex: (): CellClassIndex => ({
    findingsByPath: new Map([
      [SUBJECT_PATH, [{ className: "Tally", fields: ["total"], scopeName: "sum" }]],
    ]),
  }),
});

const namelessScopeRule = createNoClassAsMutableCell({
  loadIndex: (): CellClassIndex => ({
    findingsByPath: new Map([
      [SUBJECT_PATH, [{ className: "Tally", fields: ["total", "seen"], scopeName: null }]],
    ]),
  }),
});

const otherClassRule = createNoClassAsMutableCell({
  loadIndex: (): CellClassIndex => ({
    findingsByPath: new Map([
      [SUBJECT_PATH, [{ className: "Ledger", fields: ["total"], scopeName: "sum" }]],
    ]),
  }),
});

const emptyRule = createNoClassAsMutableCell({
  loadIndex: (): CellClassIndex => ({ findingsByPath: new Map([[SUBJECT_PATH, []]]) }),
});

describe("dont-review-it/no-class-as-mutable-cell--decide-in-an-iife", () => {
  testLintRule(namedScopeRule, {
    valid: [
      {
        name: "a class the index knows nothing about at this path is left alone",
        code: TALLY,
        filename: join(repositoryRoot, "packages/dont-review-it/src/unindexed.ts"),
      },
      {
        name: "a test file is never indexed, so it is never reported",
        code: TALLY,
        filename: join(repositoryRoot, "packages/dont-review-it/src/subject.test.ts"),
      },
      {
        name: "a class expression carries no declared name to match",
        code: "const Tally = class {\n  total = 0;\n};\n",
        filename: subjectFilename,
      },
      {
        name: "a class handed to the module surface with no name of its own carries nothing to match",
        code: "export default class {\n  total = 0;\n}\n",
        filename: subjectFilename,
      },
    ],
    invalid: [
      {
        name: "a class the index found standing in for a local variable is reported",
        code: TALLY,
        filename: subjectFilename,
        errors: [{ messageId: "containedMutableCell" }],
      },
    ],
  });

  testLintRule(namelessScopeRule, {
    valid: [],
    invalid: [
      {
        name: "a class built inside a function with no name of its own is reported in place",
        code: TALLY,
        filename: subjectFilename,
        errors: [{ messageId: "containedMutableCellInPlace" }],
      },
    ],
  });

  testLintRule(otherClassRule, {
    valid: [
      {
        name: "a class whose name the index did not find is left alone",
        code: TALLY,
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(emptyRule, {
    valid: [
      {
        name: "a path the index found nothing at is left alone",
        code: TALLY,
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });
});
