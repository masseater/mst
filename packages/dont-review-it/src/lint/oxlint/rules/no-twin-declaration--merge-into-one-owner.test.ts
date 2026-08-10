import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { buildBodyIndex } from "../lib/duplicated-bodies/body-index.ts";
import { createNoTwinDeclaration } from "./no-twin-declaration--merge-into-one-owner.ts";

const repositoryRoot = findWorkspaceRoot(process.cwd());

const SUBJECT_PATH = "packages/dont-review-it/src/subject.ts";

const OTHER_PATH = "packages/utils/src/other.ts";

const subjectFilename = join(repositoryRoot, SUBJECT_PATH);

const NODES_IN_A_SHORT_BODY = 1;

const ruleWith = (subject: { readonly name: string; readonly fingerprint: string }) =>
  createNoTwinDeclaration({
    loadIndex: () =>
      buildBodyIndex([
        {
          relativePath: SUBJECT_PATH,
          bodies: [{ ...subject, line: 1, nodeCount: NODES_IN_A_SHORT_BODY }],
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

const twinRule = ruleWith({ name: "MANIFEST_FILE_NAME", fingerprint: "manifest" });

const sameBodyRule = ruleWith({ name: "PACKAGE_FILE_NAME", fingerprint: "manifest" });

const sameNameRule = ruleWith({ name: "MANIFEST_FILE_NAME", fingerprint: "workspace" });

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
