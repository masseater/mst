import { memoize } from "es-toolkit";
import { parseSync } from "oxc-parser";

import { readTextFile } from "../canonical-values/source-files.ts";
import { astFieldsOf, statementsOf } from "../setup-modules/coupling-edges.ts";
import { spelledPathOf } from "../setup-modules/setup-module-verdict.ts";
import { relativeSpecifierTo, repositoryFilesFor } from "../setup-modules/specifier-resolution.ts";
import { passThroughExportsIn, type PassThroughExport } from "./pass-through-exports.ts";
import {
  aliasedSpecifierIn,
  matchingRestrictedTarget,
  type InternalAlias,
  type RestrictedTargetEntry,
} from "./restricted-entries.ts";

import type { AstFields } from "../ast-node.ts";

export type ReachPolicy = {
  readonly workspaceRoot: string;
  readonly entries: readonly RestrictedTargetEntry[];
  readonly aliases: readonly InternalAlias[];
};

export type RestrictedReach = {
  readonly entry: RestrictedTargetEntry;
  readonly target: string;
  readonly relays: readonly string[];
};

type Walk = {
  readonly specifier: string;
  readonly fromFile: string;
  readonly policy: ReachPolicy;
  readonly visited: ReadonlySet<string>;
  readonly relays: readonly string[];
};

const passThroughExportsAt = memoize((file: string): readonly PassThroughExport<AstFields>[] => {
  const source = readTextFile(file);
  const program = source === null ? null : astFieldsOf(parseSync(file, source).program);
  return program === null ? [] : passThroughExportsIn(statementsOf(program));
});

const reachedFilesFor = (walk: Walk): readonly string[] => {
  const { specifier, fromFile, policy } = walk;
  const asked = { specifier, fromFile, workspaceRoot: policy.workspaceRoot };
  const found = repositoryFilesFor(asked);
  if (found.length > 0) return found;

  const aliased = aliasedSpecifierIn({
    specifier,
    aliases: policy.aliases,
    workspaceRoot: policy.workspaceRoot,
  });
  return aliased === null
    ? []
    : repositoryFilesFor({ ...asked, specifier: relativeSpecifierTo(fromFile, aliased) });
};

const matchedForward = (
  forwards: readonly PassThroughExport<AstFields>[],
  listedEntries: readonly RestrictedTargetEntry[],
): { readonly entry: RestrictedTargetEntry; readonly target: string } | null =>
  forwards
    .map((forwarded) => {
      const listed = matchingRestrictedTarget({ entries: listedEntries, forwarded });
      return listed === null ? null : { entry: listed, target: forwarded.specifier };
    })
    .find((found) => found !== null) ?? null;

const reachedAt = (walk: Walk & { readonly file: string }): RestrictedReach | null => {
  const { file, policy, visited, relays } = walk;
  const forwards = passThroughExportsAt(file);
  const chain = [...relays, spelledPathOf({ file, workspaceRoot: policy.workspaceRoot })];

  const matched = matchedForward(forwards, policy.entries);
  if (matched !== null) return { ...matched, relays: chain };

  const walked = new Set([...visited, file]);
  return (
    forwards
      .map((forwarded) =>
        reachedThrough({
          ...walk,
          specifier: forwarded.specifier,
          fromFile: file,
          visited: walked,
          relays: chain,
        }),
      )
      .find((found) => found !== null) ?? null
  );
};

const reachedThrough = (walk: Walk): RestrictedReach | null =>
  reachedFilesFor(walk)
    .filter((file) => !walk.visited.has(file))
    .map((file) => reachedAt({ ...walk, file }))
    .find((found) => found !== null) ?? null;

export const restrictedTargetReachedBy = ({
  specifier,
  fromFile,
  policy,
}: {
  readonly specifier: string;
  readonly fromFile: string;
  readonly policy: ReachPolicy;
}): RestrictedReach | null =>
  reachedThrough({ specifier, fromFile, policy, visited: new Set([fromFile]), relays: [] });
