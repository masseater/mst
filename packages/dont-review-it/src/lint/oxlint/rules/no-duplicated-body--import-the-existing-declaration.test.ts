import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { buildBodyIndex, type BodyIndex } from "../lib/duplicated-bodies/body-index.ts";
import { createNoDuplicatedBody } from "./no-duplicated-body--import-the-existing-declaration.ts";

const repositoryRoot = findWorkspaceRoot(process.cwd());

const SUBJECT_PATH = "packages/dont-review-it/src/subject.ts";

const OTHER_PATH = "packages/repository-checks/src/other.ts";

const subjectFilename = join(repositoryRoot, SUBJECT_PATH);

const NODES_IN_A_REPORTED_BODY = 8;

const offPageBodyRule = createNoDuplicatedBody({
  loadIndex: (): BodyIndex => ({
    bodiesByPath: new Map([
      [
        SUBJECT_PATH,
        [{ name: "twice", line: 99, fingerprint: "shared", nodeCount: NODES_IN_A_REPORTED_BODY }],
      ],
    ]),
    sitesByFingerprint: new Map([
      [
        "shared",
        [
          { relativePath: SUBJECT_PATH, name: "twice", line: 99 },
          { relativePath: OTHER_PATH, name: "doubled", line: 7 },
        ],
      ],
    ]),
    sitesByNamedFingerprint: new Map(),
  }),
});

const unlistedFingerprintRule = createNoDuplicatedBody({
  loadIndex: (): BodyIndex => ({
    bodiesByPath: new Map([
      [
        SUBJECT_PATH,
        [{ name: "twice", line: 1, fingerprint: "unlisted", nodeCount: NODES_IN_A_REPORTED_BODY }],
      ],
    ]),
    sitesByFingerprint: new Map(),
    sitesByNamedFingerprint: new Map(),
  }),
});

const soleSiteRule = createNoDuplicatedBody({
  loadIndex: (): BodyIndex => ({
    bodiesByPath: new Map([
      [
        SUBJECT_PATH,
        [{ name: "twice", line: 1, fingerprint: "shared", nodeCount: NODES_IN_A_REPORTED_BODY }],
      ],
    ]),
    sitesByFingerprint: new Map([
      ["shared", [{ relativePath: SUBJECT_PATH, name: "twice", line: 1 }]],
    ]),
    sitesByNamedFingerprint: new Map(),
  }),
});

const sharedBodyRule = createNoDuplicatedBody({
  loadIndex: () =>
    buildBodyIndex([
      {
        relativePath: SUBJECT_PATH,
        bodies: [
          { name: "twice", line: 1, fingerprint: "shared", nodeCount: NODES_IN_A_REPORTED_BODY },
        ],
      },
      {
        relativePath: OTHER_PATH,
        bodies: [
          { name: "doubled", line: 7, fingerprint: "shared", nodeCount: NODES_IN_A_REPORTED_BODY },
        ],
      },
    ]),
});

const distinctBodyRule = createNoDuplicatedBody({
  loadIndex: () =>
    buildBodyIndex([
      {
        relativePath: SUBJECT_PATH,
        bodies: [
          { name: "twice", line: 1, fingerprint: "subject", nodeCount: NODES_IN_A_REPORTED_BODY },
        ],
      },
      {
        relativePath: OTHER_PATH,
        bodies: [
          { name: "doubled", line: 7, fingerprint: "other", nodeCount: NODES_IN_A_REPORTED_BODY },
        ],
      },
    ]),
});

describe("dont-review-it/no-duplicated-body--import-the-existing-declaration", () => {
  testLintRule(distinctBodyRule, {
    valid: [
      {
        name: "a declaration whose body is spelled nowhere else passes",
        documented: true,
        code: "const twice = (value: number): number => value * 2;",
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(offPageBodyRule, {
    valid: [],
    invalid: [
      {
        name: "a body the index places past the end of the file is reported on the file",
        code: "const twice = (value: number): number => value * 2;",
        filename: subjectFilename,
        errors: [{ messageId: "duplicatedBody" }],
      },
    ],
  });

  testLintRule(unlistedFingerprintRule, {
    valid: [
      {
        name: "a body whose fingerprint the index lists no site for is left alone",
        code: "const twice = (value: number): number => value * 2;",
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(soleSiteRule, {
    valid: [
      {
        name: "a body whose only site is this one is not spelled anywhere else",
        documented: true,
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
        documented: true,
        code: "const twice = (value: number): number => value * 2;",
        filename: subjectFilename,
        errors: [{ messageId: "duplicatedBody" }],
      },
    ],
  });
});
