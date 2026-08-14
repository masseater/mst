import { dirname, resolve } from "node:path";

import { sortBy } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { spelledNames } from "../lib/declared-coverage/coverage-declarations.ts";
import {
  LINT_CONFIGURATION_FILE,
  lintBlockOf,
  weakenedTargetRulesIn,
} from "../lib/lint-suppression/lint-config-suppression.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { toPosixPath } from "../lib/posix-path.ts";
import {
  ignoredSpecFilesIn,
  perRuleSettingsIn,
  scopeSpellingOf,
} from "../lib/spec-lint-coverage/configured-scope.ts";
import { SPEC_DISCIPLINE_RULES } from "../lib/spec-lint-coverage/guarded-rules.ts";
import {
  carriesForeignMeaning,
  RESERVED_SPEC_NAMES,
  reservedIdentifierOf,
} from "../lib/spec-lint-coverage/reserved-name-bindings.ts";
import { specDirectoryOf } from "../lib/spec-syntax/spec-directories.ts";
import { DEFAULT_SPEC_FILE_SUFFIXES, isSpecFile } from "../lib/spec-syntax/spec-files.ts";
import { testBlockBodyOf, testBlockRootNames } from "../lib/spec-syntax/test-block-declarations.ts";
import { testBlockRootIdentifier } from "../lib/spec-syntax/test-block-modifiers.ts";

import type { ESTree } from "@oxlint/plugins";

const SPELLED_SPEC_SUFFIXES = spelledNames(DEFAULT_SPEC_FILE_SUFFIXES);

const GUARDED_ELSEWHERE_DIRECTORY_NAMES: ReadonlySet<string> = new Set(["specs"]);

const GUARDED_ELSEWHERE_FILE_SUFFIXES: readonly string[] = [".spec.ts", ".spec.tsx"];

const isGuardedElsewhere = (filename: string): boolean =>
  isSpecFile(filename, GUARDED_ELSEWHERE_FILE_SUFFIXES) &&
  specDirectoryOf({
    relativePath: toPosixPath(filename),
    names: GUARDED_ELSEWHERE_DIRECTORY_NAMES,
  }) !== null;

const importedReservedNames = (declaration: ESTree.ImportDeclaration): readonly string[] =>
  declaration.specifiers.flatMap((specifier) =>
    RESERVED_SPEC_NAMES.has(specifier.local.name) ? [specifier.local.name] : [],
  );

const reachedNamesIn = (program: ESTree.Program): readonly string[] => [
  ...nodesOfType(program, "ImportDeclaration").flatMap(importedReservedNames),
  ...nodesOfType(program, "CallExpression").flatMap((call) => {
    const reserved = reservedIdentifierOf(call.callee);
    return reserved === null ? [] : [reserved.name];
  }),
];

const foreignNamesIn = (program: ESTree.Program): ReadonlyMap<string, ESTree.Node> => {
  const declaredNames: readonly (ESTree.Node | null)[] = [
    ...nodesOfType(program, "VariableDeclarator").flatMap((declarator) =>
      carriesForeignMeaning(declarator.init) ? [declarator.id] : [],
    ),
    ...nodesOfType(program, "FunctionDeclaration").map((declaration) => declaration.id),
    ...nodesOfType(program, "ClassDeclaration").map((declaration) => declaration.id),
  ];

  const bound = declaredNames.flatMap((declared) => {
    const reserved = reservedIdentifierOf(declared);
    return reserved === null ? [] : [reserved];
  });

  return new Map(
    sortBy(bound, ["start"]).map((held): readonly [string, ESTree.Node] => [held.name, held]),
  );
};

const declaresRunnerBlock = (asked: {
  readonly call: ESTree.CallExpression;
  readonly rootNames: ReadonlySet<string>;
  readonly foreignNames: ReadonlyMap<string, ESTree.Node>;
}): boolean => {
  const root = testBlockRootIdentifier(asked.call.callee);
  if (root === null || asked.foreignNames.has(root.name)) return false;
  return testBlockBodyOf(asked.call, asked.rootNames) !== null;
};

const runnerBlockRootIn = (held: {
  readonly calls: readonly ESTree.CallExpression[];
  readonly rootNames: ReadonlySet<string>;
  readonly foreignNames: ReadonlyMap<string, ESTree.Node>;
}): ESTree.IdentifierReference | null => {
  const declared = held.calls.find((call) =>
    declaresRunnerBlock({ call, rootNames: held.rootNames, foreignNames: held.foreignNames }),
  );
  return declared === undefined ? null : testBlockRootIdentifier(declared.callee);
};

export const requireSpecLintCoverage = createDontReviewItRule({
  name: "require-spec-lint-coverage--lint-every-spec-file",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every file declaring a test block to sit inside the reach of the spec discipline bundle, with those rules failing a run and their shared settings handed out from one declaration, so a run that reports nothing stands apart from a bundle that reaches nothing",
      relatedGuidelines: [],
    },
    messages: {
      uncoveredSpecFile:
        "A file that declares a test block must not carry a name outside the spec file names this bundle reads. This declaration is rooted at `{{blockName}}`, and this file name ends with none of {{specSuffixes}}. Rename this file to end with one of them, or move the declaration into a file that already does. A green run of the other rules of this bundle stands for nothing while a file holding test blocks stays out of their reach.",
      unrelatedFileInScope:
        "A file that binds `{{boundName}}` to a value outside the test runner API must not carry a spec file name. Rename `{{boundName}}` to a word outside the test vocabulary, or rename this file to end with none of {{specSuffixes}}.",
      disabledBundleRule:
        "A lint configuration must not hold `{{ruleName}}`, a rule of the spec discipline bundle, at `{{severity}}`. Set that entry to `error` and rewrite the code the rule reports. A green run of this bundle stands for nothing while one of its rules stays quiet.",
      scopedDisabledBundleRule:
        "An override must not take `{{ruleName}}` down to `{{severity}}` over {{scope}}. Delete that entry and rewrite the code the rule reports over those paths. A green run of this bundle stands for nothing while its rules stay quiet over part of the tree.",
      ignoredSpecFile:
        "An ignore entry must not cover a file this bundle reads. `{{pattern}}` covers `{{matchedPath}}`, an authored spec file. Narrow that pattern to the generated paths it stands for, or delete it and rewrite the code the bundle reports. A green run of this bundle stands for nothing while a spec file sits under an ignore entry.",
      settingWrittenPerRule:
        "A setting that more than one rule reads must not sit in the options of a single rule entry. `{{settingKey}}` sits in the options of `{{ruleName}}`, and every other reader of that setting keeps its own default. Delete that entry and hand the value to every reader from one declaration.",
    },
    schema: [],
  },
  create(inspection) {
    const reportFile = (program: ESTree.Program): void => {
      const foreignNames = foreignNamesIn(program);
      const reachedNames = reachedNamesIn(program);
      const root = runnerBlockRootIn({
        calls: nodesOfType(program, "CallExpression"),
        rootNames: testBlockRootNames(program),
        foreignNames,
      });
      if (!isSpecFile(inspection.filename, DEFAULT_SPEC_FILE_SUFFIXES)) {
        if (root === null) return;
        inspection.report({
          node: root,
          messageId: "uncoveredSpecFile",
          data: { blockName: root.name, specSuffixes: SPELLED_SPEC_SUFFIXES },
        });
        return;
      }

      if (root !== null || reachedNames.some((reachedName) => !foreignNames.has(reachedName)))
        return;
      for (const [boundName, node] of foreignNames) {
        inspection.report({
          node,
          messageId: "unrelatedFileInScope",
          data: { boundName, specSuffixes: SPELLED_SPEC_SUFFIXES },
        });
      }
    };

    const reportWeakenedRules = (lint: ESTree.ObjectExpression): void => {
      for (const weakened of weakenedTargetRulesIn({ lint, targetRules: SPEC_DISCIPLINE_RULES })) {
        const scope = scopeSpellingOf(weakened.property);
        const carried = { ruleName: weakened.ruleName, severity: weakened.severity };
        inspection.report({
          node: weakened.property,
          messageId: scope === null ? "disabledBundleRule" : "scopedDisabledBundleRule",
          data: scope === null ? carried : { ...carried, scope },
        });
      }
    };

    const reportIgnoredSpecFiles = (lint: ESTree.ObjectExpression): void => {
      const repositoryRoot = findWorkspaceRoot(
        dirname(resolve(inspection.cwd, inspection.filename)),
      );
      for (const ignored of ignoredSpecFilesIn({ lint, repositoryRoot })) {
        inspection.report({
          node: ignored.entry.element,
          messageId: "ignoredSpecFile",
          data: { pattern: ignored.entry.pattern, matchedPath: ignored.matchedPath },
        });
      }
    };

    const reportConfiguration = (program: ESTree.Program): void => {
      const lint = lintBlockOf(program);
      if (lint === null) return;
      reportWeakenedRules(lint);
      reportIgnoredSpecFiles(lint);
      for (const setting of perRuleSettingsIn(lint)) {
        inspection.report({
          node: setting.property,
          messageId: "settingWrittenPerRule",
          data: { settingKey: setting.settingKey, ruleName: setting.ruleName },
        });
      }
    };

    return {
      "Program:exit"(node: ESTree.Program) {
        if (!isGuardedElsewhere(inspection.filename)) reportFile(node);
        if (LINT_CONFIGURATION_FILE.test(toPosixPath(inspection.filename)))
          reportConfiguration(node);
      },
    };
  },
});
