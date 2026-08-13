import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { buildBodyIndex, namedFingerprintOf } from "../lib/duplicated-bodies/body-index.ts";
import { createNoTwinDeclaration } from "./no-twin-declaration--merge-into-one-owner.ts";

const repositoryRoot = findWorkspaceRoot(process.cwd());

const SUBJECT_PATH = "packages/dont-review-it/src/subject.ts";

const OTHER_PATH = "packages/repository-checks/src/other.ts";

const subjectFilename = join(repositoryRoot, SUBJECT_PATH);

const NODES_IN_A_SHORT_BODY = 1;

const twinRule = createNoTwinDeclaration({
  loadIndex: () =>
    buildBodyIndex([
      {
        relativePath: SUBJECT_PATH,
        bodies: [
          {
            name: "MANIFEST_FILE_NAME",
            fingerprint: "manifest",
            line: 1,
            nodeCount: NODES_IN_A_SHORT_BODY,
          },
        ],
      },
      {
        relativePath: OTHER_PATH,
        bodies: [
          {
            name: "MANIFEST_FILE_NAME",
            line: 7,
            fingerprint: "manifest",
            nodeCount: NODES_IN_A_SHORT_BODY,
          },
        ],
      },
    ]),
});

const offPageTwinRule = createNoTwinDeclaration({
  loadIndex: () => ({
    bodiesByPath: new Map([
      [
        SUBJECT_PATH,
        [
          {
            name: "MANIFEST_FILE_NAME",
            line: 99,
            fingerprint: "manifest",
            nodeCount: NODES_IN_A_SHORT_BODY,
          },
        ],
      ],
    ]),
    sitesByFingerprint: new Map(),
    sitesByNamedFingerprint: new Map([
      [
        namedFingerprintOf({ name: "MANIFEST_FILE_NAME", fingerprint: "manifest" }),
        [
          { relativePath: SUBJECT_PATH, name: "MANIFEST_FILE_NAME", line: 99 },
          { relativePath: OTHER_PATH, name: "MANIFEST_FILE_NAME", line: 7 },
        ],
      ],
    ]),
  }),
});

const unlistedTwinRule = createNoTwinDeclaration({
  loadIndex: () => ({
    bodiesByPath: new Map([
      [
        SUBJECT_PATH,
        [
          {
            name: "MANIFEST_FILE_NAME",
            line: 1,
            fingerprint: "manifest",
            nodeCount: NODES_IN_A_SHORT_BODY,
          },
        ],
      ],
    ]),
    sitesByFingerprint: new Map(),
    sitesByNamedFingerprint: new Map(),
  }),
});

const sameBodyRule = createNoTwinDeclaration({
  loadIndex: () =>
    buildBodyIndex([
      {
        relativePath: SUBJECT_PATH,
        bodies: [
          {
            name: "PACKAGE_FILE_NAME",
            fingerprint: "manifest",
            line: 1,
            nodeCount: NODES_IN_A_SHORT_BODY,
          },
        ],
      },
      {
        relativePath: OTHER_PATH,
        bodies: [
          {
            name: "MANIFEST_FILE_NAME",
            line: 7,
            fingerprint: "manifest",
            nodeCount: NODES_IN_A_SHORT_BODY,
          },
        ],
      },
    ]),
});

const sameNameRule = createNoTwinDeclaration({
  loadIndex: () =>
    buildBodyIndex([
      {
        relativePath: SUBJECT_PATH,
        bodies: [
          {
            name: "MANIFEST_FILE_NAME",
            fingerprint: "workspace",
            line: 1,
            nodeCount: NODES_IN_A_SHORT_BODY,
          },
        ],
      },
      {
        relativePath: OTHER_PATH,
        bodies: [
          {
            name: "MANIFEST_FILE_NAME",
            line: 7,
            fingerprint: "manifest",
            nodeCount: NODES_IN_A_SHORT_BODY,
          },
        ],
      },
    ]),
});

describe("dont-review-it/no-twin-declaration--merge-into-one-owner", () => {
  testLintRule(sameBodyRule, {
    valid: [
      {
        name: "a declaration that shares only its body with another one passes",
        code: `const PACKAGE_FILE_NAME = "package.json";`,
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(sameNameRule, {
    valid: [
      {
        name: "a declaration that shares only its name with another one passes",
        code: `const MANIFEST_FILE_NAME = "pnpm-workspace.yaml";`,
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(unlistedTwinRule, {
    valid: [
      {
        name: "a declaration whose name and body the index lists no site for is left alone",
        code: `const MANIFEST_FILE_NAME = "package.json";`,
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(offPageTwinRule, {
    valid: [],
    invalid: [
      {
        name: "a declaration the index places past the end of the file is reported on the file",
        code: `const MANIFEST_FILE_NAME = "package.json";`,
        filename: subjectFilename,
        errors: [{ messageId: "twinDeclaration" }],
      },
    ],
  });

  testLintRule(twinRule, {
    valid: [
      {
        name: "a test file is never linted, so it is never reported",
        code: `const MANIFEST_FILE_NAME = "package.json";`,
        filename: join(repositoryRoot, "packages/dont-review-it/src/subject.test.ts"),
      },
      {
        name: "a file the index does not know is left alone",
        code: `const MANIFEST_FILE_NAME = "package.json";`,
        filename: join(repositoryRoot, "packages/dont-review-it/src/unindexed.ts"),
      },
    ],
    invalid: [
      {
        name: "a declaration that shares both its name and its body is reported although the body is short",
        code: `const MANIFEST_FILE_NAME = "package.json";`,
        filename: subjectFilename,
        errors: [{ messageId: "twinDeclaration" }],
      },
    ],
  });
});
