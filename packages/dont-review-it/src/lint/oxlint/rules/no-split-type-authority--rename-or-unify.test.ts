import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import {
  buildTypeAuthorityIndex,
  type ScannedTypeFile,
} from "../lib/split-type-authority/authority-index.ts";
import { typeDeclarationsIn } from "../lib/split-type-authority/type-declarations.ts";
import { createNoSplitTypeAuthority } from "./no-split-type-authority--rename-or-unify.ts";

type Placement = {
  readonly relativePath: string;
  readonly workspacePath: string;
};

const repositoryRoot = findWorkspaceRoot(process.cwd());

const SUBJECT: Placement = {
  relativePath: "packages/dont-review-it/src/subject.ts",
  workspacePath: "packages/dont-review-it",
};

const OTHER: Placement = {
  relativePath: "packages/dont-review-it/src/other.ts",
  workspacePath: "packages/dont-review-it",
};

const FAR: Placement = {
  relativePath: "packages/utils/src/far.ts",
  workspacePath: "packages/utils",
};

const subjectFilename = join(repositoryRoot, SUBJECT.relativePath);

const THREE_NAMED_MEMBERS = "{ readonly a: string; readonly b: number; readonly c: Named }";

const SUBJECT_CODE = `export type Shape = ${THREE_NAMED_MEMBERS};`;

const OTHER_SHAPE_CODE = "export type Shape = { readonly a: string };";

const FAR_NAME_CODE = `export type Basket = ${THREE_NAMED_MEMBERS};`;

const fileAt = (placement: Placement, source: string): ScannedTypeFile => ({
  relativePath: placement.relativePath,
  workspacePath: placement.workspacePath,
  declarations: typeDeclarationsIn(source),
});

const ruleOver = (files: readonly ScannedTypeFile[]) =>
  createNoSplitTypeAuthority({ loadIndex: () => buildTypeAuthorityIndex(files) });

const splitShapeRule = ruleOver([fileAt(SUBJECT, SUBJECT_CODE), fileAt(OTHER, OTHER_SHAPE_CODE)]);

const splitNameRule = ruleOver([fileAt(SUBJECT, SUBJECT_CODE), fileAt(FAR, FAR_NAME_CODE)]);

const splitBothWaysRule = ruleOver([
  fileAt(SUBJECT, SUBJECT_CODE),
  fileAt(OTHER, OTHER_SHAPE_CODE),
  fileAt(FAR, FAR_NAME_CODE),
]);

const settledRule = ruleOver([fileAt(SUBJECT, SUBJECT_CODE), fileAt(OTHER, SUBJECT_CODE)]);

const offPageRule = ruleOver([
  fileAt(SUBJECT, `\n\n\n\n\n${SUBJECT_CODE}`),
  fileAt(OTHER, OTHER_SHAPE_CODE),
]);

describe("dont-review-it/no-split-type-authority--rename-or-unify", () => {
  testLintRule(splitShapeRule, {
    valid: [
      {
        name: "a test file is never linted, so it is never reported",
        code: SUBJECT_CODE,
        filename: join(repositoryRoot, "packages/dont-review-it/src/subject.test.ts"),
      },
      {
        name: "a file the index does not know is left alone",
        code: SUBJECT_CODE,
        filename: join(repositoryRoot, "packages/dont-review-it/src/unindexed.ts"),
      },
    ],
    invalid: [
      {
        name: "a type whose name carries another shape in the workspace is reported",
        code: SUBJECT_CODE,
        filename: subjectFilename,
        errors: [{ messageId: "splitTypeShape" }],
      },
    ],
  });

  testLintRule(settledRule, {
    valid: [
      {
        name: "a type declared twice with one shape is left to the rule that reads exact matches",
        code: SUBJECT_CODE,
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(splitNameRule, {
    valid: [],
    invalid: [
      {
        name: "a type whose structure carries another name in the repository is reported",
        code: SUBJECT_CODE,
        filename: subjectFilename,
        errors: [{ messageId: "splitTypeName" }],
      },
    ],
  });

  testLintRule(splitBothWaysRule, {
    valid: [],
    invalid: [
      {
        name: "a type split both ways is reported once for each way it is split",
        code: SUBJECT_CODE,
        filename: subjectFilename,
        errors: [{ messageId: "splitTypeShape" }, { messageId: "splitTypeName" }],
      },
    ],
  });

  testLintRule(offPageRule, {
    valid: [],
    invalid: [
      {
        name: "a type the index places past the end of the file is reported on the file",
        code: SUBJECT_CODE,
        filename: subjectFilename,
        errors: [{ messageId: "splitTypeShape" }],
      },
    ],
  });
});
