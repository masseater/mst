import { ancestorsOf } from "../ast-node.ts";
import { spelledNames } from "../declared-coverage/coverage-declarations.ts";
import { matchesAnchoredGlobPath } from "../glob-path-match.ts";
import {
  ignoreEntriesIn,
  ruleBlocksIn,
  type IgnoreEntry,
} from "../lint-suppression/lint-config-suppression.ts";
import { GENERATED_PATHS } from "../lint-suppression/protected-rules.ts";
import { objectValueOf, propertyKeyOf } from "../object-literal.ts";
import {
  UNSCANNED_DIRECTORY_NAMES,
  worktreeFilePathsUnder,
} from "../repository-scan/worktree-files.ts";
import { DEFAULT_SPEC_FILE_SUFFIXES, isSpecFile } from "../spec-syntax/spec-files.ts";
import { SHARED_SETTING_KEYS } from "./guarded-rules.ts";

import type { ESTree } from "@oxlint/plugins";

export type PerRuleSetting = {
  readonly property: ESTree.ObjectProperty;
  readonly ruleName: string;
  readonly settingKey: string;
};

export type IgnoredSpecFile = {
  readonly entry: IgnoreEntry;
  readonly matchedPath: string;
};

const sharedSettingsIn = (asked: {
  readonly options: ESTree.ObjectExpression;
  readonly ruleName: string;
}): readonly PerRuleSetting[] =>
  asked.options.properties.flatMap<PerRuleSetting>((property) => {
    if (property.type !== "Property") return [];
    const settingKey = propertyKeyOf(property);
    if (settingKey === null || !SHARED_SETTING_KEYS.has(settingKey)) return [];
    return [{ property, ruleName: asked.ruleName, settingKey }];
  });

const handedOptionsOf = (value: ESTree.Expression): readonly ESTree.ObjectExpression[] =>
  value.type === "ArrayExpression"
    ? value.elements.filter((element) => element?.type === "ObjectExpression")
    : [];

const settingsOfEntry = (property: ESTree.ObjectProperty): readonly PerRuleSetting[] => {
  const ruleName = propertyKeyOf(property);
  if (ruleName === null) return [];
  return handedOptionsOf(property.value).flatMap((options) =>
    sharedSettingsIn({ options, ruleName }),
  );
};

const settingsInBlock = (rules: ESTree.ObjectExpression): readonly PerRuleSetting[] =>
  rules.properties.flatMap((property) =>
    property.type === "Property" ? settingsOfEntry(property) : [],
  );

export const perRuleSettingsIn = (lint: ESTree.ObjectExpression): readonly PerRuleSetting[] =>
  ruleBlocksIn(lint).flatMap(settingsInBlock);

const spelledPatternsOf = (files: ESTree.Expression): readonly string[] =>
  files.type === "ArrayExpression"
    ? files.elements.flatMap((element) =>
        element?.type === "Literal" && typeof element.value === "string" ? [element.value] : [],
      )
    : [];

const scopePatternsOf = (node: ESTree.Node): readonly string[] | null => {
  if (node.type !== "ObjectExpression") return null;
  const files = objectValueOf({ object: node, key: "files" });
  return files === null ? null : spelledPatternsOf(files);
};

export const scopeSpellingOf = (property: ESTree.ObjectProperty): string | null => {
  const patterns = ancestorsOf(property)
    .map(scopePatternsOf)
    .findLast((found) => found !== null);
  return patterns === undefined || patterns.length === 0 ? null : spelledNames(patterns);
};

const isGeneratedPath = (relativePath: string): boolean =>
  GENERATED_PATHS.some((pattern) => matchesAnchoredGlobPath({ relativePath, pattern }));

export const authoredSpecPathsUnder = (repositoryRoot: string): readonly string[] =>
  worktreeFilePathsUnder({
    root: repositoryRoot,
    unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
  })
    .filter((relativePath) => isSpecFile(relativePath, DEFAULT_SPEC_FILE_SUFFIXES))
    .filter((relativePath) => !isGeneratedPath(relativePath));

export const ignoredSpecFilesIn = (asked: {
  readonly lint: ESTree.ObjectExpression;
  readonly repositoryRoot: string;
}): readonly IgnoredSpecFile[] => {
  const entries = ignoreEntriesIn(asked.lint);
  if (entries.length === 0) return [];

  const specPaths = authoredSpecPathsUnder(asked.repositoryRoot);
  return entries.flatMap<IgnoredSpecFile>((entry) => {
    const matchedPath = specPaths.find((relativePath) =>
      matchesAnchoredGlobPath({ relativePath, pattern: entry.pattern }),
    );
    return matchedPath === undefined ? [] : [{ entry, matchedPath }];
  });
};
