import { relative } from "node:path";

import { matchesGlobSegment } from "@mst/lint-rule-authoring";
import { memoize } from "es-toolkit";

import { segmentsOf } from "../path-segments.ts";
import { toPosixPath } from "../posix-path.ts";
import { assetsStemOf } from "../spec-syntax/assets-files.ts";
import { astFieldsOf, nodeTypeOf, statementsOf, TYPE_ONLY_KIND } from "./coupling-edges.ts";
import { couplingEdgesOf, entryReachableFilesOf, parsedProgramAt } from "./entry-reachability.ts";
import { isInsideDirectory, owningPackageDirectoryOf } from "./package-entries.ts";
import { isReachedOnlyFromSpecs } from "./spec-only-packages.ts";
import { resolveCoupling } from "./specifier-resolution.ts";

import type { AstFields } from "../ast-node.ts";

const RELAY_HOP_LIMIT = 4;

const TYPE_DECLARATION_TYPES: ReadonlySet<string> = new Set([
  "EmptyStatement",
  "TSDeclareFunction",
  "TSImportEqualsDeclaration",
  "TSInterfaceDeclaration",
  "TSModuleDeclaration",
  "TSTypeAliasDeclaration",
]);

const isTypeStatement = (statement: AstFields): boolean => {
  const nodeType = nodeTypeOf(statement);
  if (TYPE_DECLARATION_TYPES.has(nodeType) || statement.declare === true) return true;
  if (nodeType === "ImportDeclaration") return statement.importKind === TYPE_ONLY_KIND;
  if (nodeType === "ExportAllDeclaration") return statement.exportKind === TYPE_ONLY_KIND;
  if (nodeType !== "ExportNamedDeclaration") return false;
  if (statement.exportKind === TYPE_ONLY_KIND) return true;

  const declared = astFieldsOf(statement.declaration);
  return declared !== null && isTypeStatement(declared);
};

const carriesOnlyTypes = memoize((file: string): boolean => {
  const program = parsedProgramAt(file);
  return program !== null && statementsOf(program).every(isTypeStatement);
});

export type SetupModulePolicy = {
  readonly workspaceRoot: string;
  readonly namePatterns: readonly string[];
  readonly allowedPackageSpecifiers: readonly string[];
  readonly assetsNameMarkers: ReadonlySet<string>;
};

const isAllowedPackageSpecifier = ({
  specifier,
  policy,
}: {
  readonly specifier: string;
  readonly policy: SetupModulePolicy;
}): boolean =>
  policy.allowedPackageSpecifiers.some(
    (allowed) => specifier === allowed || specifier.startsWith(`${allowed}/`),
  );

const isAssetsFile = ({
  file,
  policy,
}: {
  readonly file: string;
  readonly policy: SetupModulePolicy;
}): boolean => assetsStemOf(file, policy.assetsNameMarkers) !== null;

export type ReachedSetupModule = {
  readonly path: string;
  readonly relays: readonly string[];
  readonly reason: "forbiddenName" | "reachedOnlyFromSpecs";
};

export const spelledPathOf = ({
  file,
  workspaceRoot,
}: {
  readonly file: string;
  readonly workspaceRoot: string;
}): string =>
  isInsideDirectory({ path: file, directory: workspaceRoot })
    ? toPosixPath(relative(workspaceRoot, file))
    : toPosixPath(file);

const carriesForbiddenName = ({
  file,
  policy,
}: {
  readonly file: string;
  readonly policy: SetupModulePolicy;
}): boolean =>
  segmentsOf({
    path: spelledPathOf({ file, workspaceRoot: policy.workspaceRoot }),
    separator: "/",
  }).some((segment) =>
    policy.namePatterns.some((pattern) => matchesGlobSegment({ segment, pattern })),
  );

const verdictFor = ({
  file,
  policy,
}: {
  readonly file: string;
  readonly policy: SetupModulePolicy;
}): ReachedSetupModule["reason"] | "carriesNoSetup" | "relay" => {
  if (isAssetsFile({ file, policy }) || carriesOnlyTypes(file)) return "carriesNoSetup";

  const packageDirectory = owningPackageDirectoryOf(file);
  const reachable =
    packageDirectory === null
      ? null
      : entryReachableFilesOf({ packageDirectory, workspaceRoot: policy.workspaceRoot });
  if (reachable?.has(file) === true) return "carriesNoSetup";
  if (carriesForbiddenName({ file, policy })) return "forbiddenName";
  return reachable === null ? "relay" : "reachedOnlyFromSpecs";
};

const publicEntryReached = ({
  packageDirectory,
  policy,
  relays,
}: {
  readonly packageDirectory: string;
  readonly policy: SetupModulePolicy;
  readonly relays: readonly string[];
}): ReachedSetupModule | null => {
  const { workspaceRoot } = policy;
  if (!isReachedOnlyFromSpecs({ packageDirectory, workspaceRoot })) return null;
  return {
    path: spelledPathOf({ file: packageDirectory, workspaceRoot }),
    relays,
    reason: "reachedOnlyFromSpecs",
  };
};

const forwardedThrough = (walk: {
  readonly file: string;
  readonly policy: SetupModulePolicy;
  readonly visited: ReadonlySet<string>;
  readonly relays: readonly string[];
}): ReachedSetupModule | null => {
  const { file, policy, visited, relays } = walk;
  if (relays.length >= RELAY_HOP_LIMIT) return null;

  return (
    couplingEdgesOf(file)
      .filter((edge) => edge.carriesValues)
      .map((edge) =>
        reachedThrough({
          specifier: edge.specifier,
          fromFile: file,
          policy,
          visited: new Set([...visited, file]),
          relays: [...relays, spelledPathOf({ file, workspaceRoot: policy.workspaceRoot })],
        }),
      )
      .find((found) => found !== null) ?? null
  );
};

const reachedAt = (walk: {
  readonly file: string;
  readonly policy: SetupModulePolicy;
  readonly visited: ReadonlySet<string>;
  readonly relays: readonly string[];
}): ReachedSetupModule | null => {
  const { file, policy, visited, relays } = walk;
  const verdict = verdictFor({ file, policy });
  if (verdict === "carriesNoSetup") return null;
  if (verdict === "relay") return forwardedThrough({ file, policy, visited, relays });
  return {
    path: spelledPathOf({ file, workspaceRoot: policy.workspaceRoot }),
    relays,
    reason: verdict,
  };
};

const reachedThrough = (walk: {
  readonly specifier: string;
  readonly fromFile: string;
  readonly policy: SetupModulePolicy;
  readonly visited: ReadonlySet<string>;
  readonly relays: readonly string[];
}): ReachedSetupModule | null => {
  const { specifier, fromFile, policy, visited, relays } = walk;
  if (isAllowedPackageSpecifier({ specifier, policy })) return null;

  const resolved = resolveCoupling({ specifier, fromFile, workspaceRoot: policy.workspaceRoot });
  if (resolved === null) return null;
  if (resolved.kind === "publicEntry") {
    return publicEntryReached({ packageDirectory: resolved.packageDirectory, policy, relays });
  }
  if (visited.has(resolved.path)) return null;
  return reachedAt({ file: resolved.path, policy, visited, relays });
};

export const setupModuleReachedBy = ({
  specifier,
  fromFile,
  policy,
}: {
  readonly specifier: string;
  readonly fromFile: string;
  readonly policy: SetupModulePolicy;
}): ReachedSetupModule | null =>
  reachedThrough({ specifier, fromFile, policy, visited: new Set([fromFile]), relays: [] });
