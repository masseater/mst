import { join } from "node:path";

import { memoize } from "es-toolkit";

import { LINT_CONFIGURATION_FILE } from "../lint-suppression/lint-config-suppression.ts";
import { ARRAY_EXPRESSION } from "../node-kinds.ts";
import { toPosixPath } from "../posix-path.ts";
import {
  UNSCANNED_DIRECTORY_NAMES,
  worktreeFilePathsUnder,
} from "../repository-scan/worktree-files.ts";
import {
  astFieldsOf,
  constantSpecifiersIn,
  listedFieldsOf,
  nodeTypeOf,
  staticSpecifierOf,
  statementsOf,
} from "../setup-modules/coupling-edges.ts";
import { couplingTargetsOf, parsedProgramAt } from "../setup-modules/entry-reachability.ts";
import { isInsideDirectory } from "../setup-modules/package-entries.ts";
import { repositoryFilesFor } from "../setup-modules/specifier-resolution.ts";
import { DEFAULT_SPEC_FILE_SUFFIXES, isSpecFile } from "../spec-syntax/spec-files.ts";

import type { AstFields } from "../ast-node.ts";

export const isRunnerConfigurationFile = (filename: string): boolean =>
  LINT_CONFIGURATION_FILE.test(toPosixPath(filename));

const NO_CONSTANTS: ReadonlyMap<string, string> = new Map();

const propertyNameOf = (property: AstFields): string | null => {
  if (property.computed === true) return null;
  const keyNode = astFieldsOf(property.key);
  if (keyNode === null) return null;
  if (nodeTypeOf(keyNode) === "Identifier") return String(keyNode.name);
  return staticSpecifierOf(keyNode, NO_CONSTANTS);
};

const valueAt = (holder: AstFields, named: string): AstFields | null => {
  const found = listedFieldsOf(holder.properties).findLast(
    (property) => propertyNameOf(property) === named,
  );
  return found === undefined ? null : astFieldsOf(found.value);
};

const objectFrom = (written: AstFields | null): AstFields | null => {
  if (written === null) return null;
  const nodeType = nodeTypeOf(written);
  if (nodeType === "ObjectExpression") return written;
  if (nodeType !== "CallExpression") return null;
  const [handed] = listedFieldsOf(written.arguments);
  return handed === undefined ? null : objectFrom(handed);
};

export const RUNNER_BLOCK_KEY = "test";

const runnerBlockIn = (program: AstFields): AstFields | null => {
  const exported = statementsOf(program).findLast(
    (statement) => nodeTypeOf(statement) === "ExportDefaultDeclaration",
  );
  if (exported === undefined) return null;
  const config = objectFrom(astFieldsOf(exported.declaration));
  return config === null ? null : objectFrom(valueAt(config, RUNNER_BLOCK_KEY));
};

const spelledEntriesOf = (
  written: AstFields | null,
  constants: ReadonlyMap<string, string>,
): readonly string[] => {
  if (written === null) return [];
  const single = staticSpecifierOf(written, constants);
  if (single !== null) return [single];
  if (nodeTypeOf(written) !== ARRAY_EXPRESSION) return [];
  return listedFieldsOf(written.elements).flatMap((held) => {
    const spelled = staticSpecifierOf(held, constants);
    return spelled === null ? [] : [spelled];
  });
};

const REGISTERED_SETUP_KEYS: readonly string[] = ["setupFiles", "globalSetup"];

const PROJECT_LIST_KEY = "projects";

const registeredEntriesIn = (
  runnerBlock: AstFields,
  constants: ReadonlyMap<string, string>,
): readonly string[] => {
  const own = REGISTERED_SETUP_KEYS.flatMap((registeredKey) =>
    spelledEntriesOf(valueAt(runnerBlock, registeredKey), constants),
  );
  const projects = valueAt(runnerBlock, PROJECT_LIST_KEY);
  if (projects === null || nodeTypeOf(projects) !== ARRAY_EXPRESSION) return own;

  return [
    ...own,
    ...listedFieldsOf(projects.elements).flatMap((listed) => {
      const nested = objectFrom(valueAt(listed, RUNNER_BLOCK_KEY));
      return nested === null ? [] : registeredEntriesIn(nested, constants);
    }),
  ];
};

const entryFilesFor = (asked: {
  readonly spelled: string;
  readonly configPath: string;
  readonly workspaceRoot: string;
}): readonly string[] => {
  const spelled = toPosixPath(asked.spelled);
  const candidates = spelled.startsWith(".") ? [spelled] : [spelled, `./${spelled}`];
  return candidates.flatMap((specifier) =>
    repositoryFilesFor({
      specifier,
      fromFile: asked.configPath,
      workspaceRoot: asked.workspaceRoot,
    }),
  );
};

const registeredEntriesUnder = (workspaceRoot: string): readonly string[] =>
  worktreeFilePathsUnder({
    root: workspaceRoot,
    unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
  })
    .filter(isRunnerConfigurationFile)
    .flatMap((relativePath) => {
      const configPath = join(workspaceRoot, relativePath);
      const program = parsedProgramAt(configPath);
      const runnerBlock = program === null ? null : runnerBlockIn(program);
      if (program === null || runnerBlock === null) return [];

      const constants = constantSpecifiersIn(program.body);
      return registeredEntriesIn(runnerBlock, constants).flatMap((spelled) =>
        entryFilesFor({ spelled, configPath, workspaceRoot }),
      );
    });

const reachedFrom = (walk: {
  readonly frontier: readonly string[];
  readonly reached: ReadonlySet<string>;
  readonly workspaceRoot: string;
}): ReadonlySet<string> => {
  const fresh = walk.frontier.filter(
    (file) =>
      !walk.reached.has(file) &&
      !isSpecFile(file, DEFAULT_SPEC_FILE_SUFFIXES) &&
      isInsideDirectory({ path: file, directory: walk.workspaceRoot }),
  );
  if (fresh.length === 0) return walk.reached;

  return reachedFrom({
    frontier: fresh.flatMap((file) =>
      couplingTargetsOf({ file, workspaceRoot: walk.workspaceRoot }),
    ),
    reached: new Set([...walk.reached, ...fresh]),
    workspaceRoot: walk.workspaceRoot,
  });
};

export const sharedSetupFilesUnder = memoize(
  ({
    workspaceRoot,
    declaredEntries,
  }: {
    readonly workspaceRoot: string;
    readonly declaredEntries: readonly string[];
  }): ReadonlySet<string> => {
    const declared = declaredEntries.map((relativePath) => join(workspaceRoot, relativePath));
    const frontier = declared.length === 0 ? registeredEntriesUnder(workspaceRoot) : declared;
    return reachedFrom({ frontier, reached: new Set(), workspaceRoot });
  },
  { getCacheKey: (asked) => [asked.workspaceRoot, ...asked.declaredEntries].join("\n") },
);
