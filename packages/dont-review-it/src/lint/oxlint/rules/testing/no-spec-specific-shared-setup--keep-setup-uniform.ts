import { dirname, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { findWorkspaceRoot } from "../../lib/canonical-values/workspace-root.ts";
import { defaultExportedObject } from "../../lib/default-exported-object.ts";
import { configuredSuffixesFrom } from "../../lib/file-name-suffixes.ts";
import { objectValueOf } from "../../lib/object-literal.ts";
import { namesAuthoredSpec, spelledPathIn } from "../../lib/shared-setup/named-spec-paths.ts";
import {
  isRunnerConfigurationFile,
  RUNNER_BLOCK_KEY,
  sharedSetupFilesUnder,
} from "../../lib/shared-setup/registered-setup-files.ts";
import {
  declaredBindingNameOf,
  handsOverValue,
  identifyingMemberNameOf,
  standsForOwnValue,
  steeringHolderOf,
  TEST_IDENTIFYING_NAMES,
} from "../../lib/shared-setup/test-identity-reads.ts";
import { authoredSpecPathsUnder } from "../../lib/spec-lint-coverage/configured-scope.ts";
import { staticSpelling } from "../../lib/spec-syntax/static-names.ts";

import type { Context, ESTree, Visitor } from "@oxlint/plugins";
import type { LiteralNode } from "../../lib/canonical-values/literal-position.ts";

const SHARED_SETUP_FILES_OPTION = "sharedSetupFiles";

type SpecPathReader = () => readonly string[];

const configurationVisitor = (asked: {
  readonly inspection: Context;
  readonly specPathsOf: SpecPathReader;
}): Visitor => {
  const runnerBlockOf = memoize((): ESTree.Expression | null => {
    const config = defaultExportedObject(asked.inspection.sourceCode.ast);
    return config === null ? null : objectValueOf({ object: config, key: RUNNER_BLOCK_KEY });
  });

  return {
    Literal(node: LiteralNode) {
      const runnerBlock = runnerBlockOf();
      if (runnerBlock === null) return;
      if (node.start < runnerBlock.start || runnerBlock.end < node.end) return;

      const spelled = spelledPathIn(node);
      if (spelled === null) return;
      if (!namesAuthoredSpec({ spelled, specPaths: asked.specPathsOf() })) return;
      asked.inspection.report({ node, messageId: "specSpecificRunnerSetting", data: { spelled } });
    },
  };
};

const IDENTITY_MESSAGES = {
  branch: "specIdentifyingBranch",
  argument: "specIdentifyingArgument",
};

const NAMING_MESSAGES = {
  branch: "specNamingBranch",
  argument: "specNamingArgument",
};

const setupVisitor = (asked: {
  readonly inspection: Context;
  readonly specPathsOf: SpecPathReader;
}): Visitor => {
  const identityNames = new Set<string>();
  const specNamingNames = new Set<string>();

  const settleRead = (read: {
    readonly node: ESTree.Node;
    readonly spelled: string;
    readonly held: Set<string>;
    readonly messageIds: { readonly branch: string; readonly argument: string };
  }): void => {
    const holder = steeringHolderOf(read.node);
    if (holder === null) {
      const spelled = declaredBindingNameOf(read.node);
      if (spelled !== null) read.held.add(spelled);
      return;
    }

    asked.inspection.report({
      node: read.node,
      messageId: handsOverValue(holder) ? read.messageIds.argument : read.messageIds.branch,
      data: { spelled: read.spelled },
    });
  };

  const settleSpelling = (node: ESTree.Node, spelled: string | null): void => {
    if (spelled === null) return;
    if (!namesAuthoredSpec({ spelled, specPaths: asked.specPathsOf() })) return;
    settleRead({ node, spelled, held: specNamingNames, messageIds: NAMING_MESSAGES });
  };

  return {
    Identifier(node: ESTree.IdentifierReference) {
      if (!standsForOwnValue({ parent: node.parent, held: node })) return;
      const spelled = node.name;
      if (TEST_IDENTIFYING_NAMES.has(spelled) || identityNames.has(spelled)) {
        settleRead({ node, spelled, held: identityNames, messageIds: IDENTITY_MESSAGES });
        return;
      }
      if (!specNamingNames.has(spelled)) return;
      settleRead({ node, spelled, held: specNamingNames, messageIds: NAMING_MESSAGES });
    },
    MemberExpression(node: ESTree.MemberExpression) {
      const spelled = identifyingMemberNameOf(node);
      if (spelled === null) return;
      settleRead({ node, spelled, held: identityNames, messageIds: IDENTITY_MESSAGES });
    },
    Literal(node: LiteralNode) {
      settleSpelling(node, spelledPathIn(node));
    },
    TemplateLiteral(node: ESTree.TemplateLiteral) {
      settleSpelling(node, staticSpelling(node));
    },
  };
};

export const noSpecSpecificSharedSetup = createDontReviewItRule({
  name: "no-spec-specific-shared-setup--keep-setup-uniform",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a shared setup module or a runner configuration telling one spec from another, so the cleanup and the file system rules keep standing on a setup that hands every spec the same starting state",
      relatedGuidelines: ["docs/guidelines/tests.md"],
    },
    messages: {
      specIdentifyingBranch:
        "A shared setup module must not branch on `{{spelled}}`, a value that tells the running spec from the others. Delete that branch and write the setup it guards into a fixture in the spec that needs it.",
      specIdentifyingArgument:
        "A shared setup module must not hand `{{spelled}}`, a value that tells the running spec from the others, to a function. Delete that argument and write the setup it selects into a fixture in the spec that needs it.",
      specNamingBranch:
        "A shared setup module must not branch on `{{spelled}}`, a path naming an authored spec. Delete that branch and write the setup it guards into a fixture in that spec.",
      specNamingArgument:
        "A shared setup module must not hand `{{spelled}}`, a path naming an authored spec, to a function. Delete that argument and write the setup it selects into a fixture in that spec.",
      specSpecificRunnerSetting:
        "A runner configuration must not write out `{{spelled}}`, a path naming an authored spec, inside the block that configures the run. Delete that entry and give every spec the same setting.",
    },
    schema: [
      {
        type: "object",
        properties: {
          sharedSetupFiles: { type: "array", items: { type: "string" }, minItems: 1 },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const filename = resolve(inspection.cwd, inspection.filename);
    const workspaceRoot = findWorkspaceRoot(dirname(filename));
    const specPathsOf = memoize((): readonly string[] => authoredSpecPathsUnder(workspaceRoot));
    if (isRunnerConfigurationFile(inspection.filename)) {
      return configurationVisitor({ inspection, specPathsOf });
    }

    const declaredEntries = configuredSuffixesFrom(inspection.options, {
      optionName: SHARED_SETUP_FILES_OPTION,
      carried: [],
    });
    if (!sharedSetupFilesUnder({ workspaceRoot, declaredEntries }).has(filename)) return {};
    return setupVisitor({ inspection, specPathsOf });
  },
});
