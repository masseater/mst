import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { buildBodyIndex } from "../lib/duplicated-bodies/body-index.ts";
import { createNoDuplicatedBody } from "./no-duplicated-body--import-the-existing-declaration.ts";

const repositoryRoot = findWorkspaceRoot(process.cwd());

const SUBJECT_PATH = "packages/dont-review-it/src/subject.ts";

const OTHER_PATH = "packages/utils/src/other.ts";

const subjectFilename = join(repositoryRoot, SUBJECT_PATH);

const NODES_IN_A_REPORTED_BODY = 8;

const indexWith = (fingerprintOfSubject: string, fingerprintOfOther: string) =>
  buildBodyIndex([
    {
      relativePath: SUBJECT_PATH,
      bodies: [
        {
          name: "twice",
          line: 1,
          fingerprint: fingerprintOfSubject,
          nodeCount: NODES_IN_A_REPORTED_BODY,
        },
      ],
    },
    {
      relativePath: OTHER_PATH,
      bodies: [
        {
          name: "doubled",
          line: 7,
          fingerprint: fingerprintOfOther,
          nodeCount: NODES_IN_A_REPORTED_BODY,
        },
      ],
    },
  ]);

const ruleWith = (fingerprintOfSubject: string, fingerprintOfOther: string) =>
  createNoDuplicatedBody({
    loadIndex: () => indexWith(fingerprintOfSubject, fingerprintOfOther),
  });

const sharedBodyRule = ruleWith("shared", "shared");

const distinctBodyRule = ruleWith("subject", "other");

describe("dont-review-it/no-duplicated-body--import-the-existing-declaration", () => {
  testLintRule(distinctBodyRule, {
    valid: [
      {
        name: "a declaration whose body is spelled nowhere else passes",
        code: "const twice = (value: number): number => value * 2;",
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(sharedBodyRule, {
    valid: [
      {
        name: "a test file is never indexed, so it is never reported",
        code: "const twice = (value: number): number => value * 2;",
        filename: join(repositoryRoot, "packages/dont-review-it/src/subject.test.ts"),
      },
      {
        name: "a file the index does not know is left alone",
        code: "const twice = (value: number): number => value * 2;",
        filename: join(repositoryRoot, "packages/dont-review-it/src/unindexed.ts"),
      },
    ],
    invalid: [
      {
        name: "a declaration whose body is spelled the same elsewhere is reported",
        code: "const twice = (value: number): number => value * 2;",
        filename: subjectFilename,
        errors: [{ messageId: "duplicatedBody" }],
      },
    ],
  });
});
