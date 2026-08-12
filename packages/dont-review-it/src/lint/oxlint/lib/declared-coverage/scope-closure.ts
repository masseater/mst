import { join, relative } from "node:path";

import { uniqBy } from "es-toolkit";

import { toPosixPath } from "../posix-path.ts";
import { couplingTargetsOf } from "../setup-modules/entry-reachability.ts";
import { pathsMatching } from "./uncovered-paths.ts";

import type { CoverageFinding, ScopeRegistration } from "./coverage-declarations.ts";

export const UNREGISTERED_SCOPE_REACH_MESSAGE_ID = "unregisteredScopeReach";

const stepsFrom = (traversal: {
  readonly repositoryRoot: string;
  readonly frontier: readonly string[];
  readonly walked: ReadonlySet<string>;
}): readonly { readonly fromFile: string; readonly toFile: string }[] => {
  const fresh = traversal.frontier.filter((file) => !traversal.walked.has(file));
  if (fresh.length === 0) return [];

  const stepped = fresh.flatMap((fromFile) =>
    couplingTargetsOf({ file: fromFile, workspaceRoot: traversal.repositoryRoot }).map(
      (toFile) => ({ fromFile, toFile }),
    ),
  );
  return [
    ...stepped,
    ...stepsFrom({
      repositoryRoot: traversal.repositoryRoot,
      frontier: stepped.map((step) => step.toFile),
      walked: new Set([...traversal.walked, ...fresh]),
    }),
  ];
};

const withinRepository = (asked: {
  readonly repositoryRoot: string;
  readonly file: string;
}): string => toPosixPath(relative(asked.repositoryRoot, asked.file));

const scopeFindings = (asked: {
  readonly scope: ScopeRegistration;
  readonly paths: readonly string[];
  readonly repositoryRoot: string;
}): readonly CoverageFinding[] => {
  const { repositoryRoot } = asked;
  const registered = pathsMatching({ paths: asked.paths, patterns: asked.scope.registeredPaths });
  const registeredPaths = new Set(registered);
  const authoredPaths = new Set(asked.paths);

  const reached = stepsFrom({
    repositoryRoot,
    frontier: registered.map((relativePath) => join(repositoryRoot, relativePath)),
    walked: new Set(),
  }).map((step) => ({
    reachingPath: withinRepository({ repositoryRoot, file: step.fromFile }),
    reachedPath: withinRepository({ repositoryRoot, file: step.toFile }),
  }));

  const missing = reached.filter(
    (step) => authoredPaths.has(step.reachedPath) && !registeredPaths.has(step.reachedPath),
  );
  return uniqBy(missing, (step) => step.reachedPath).map((step) => ({
    heldPath: step.reachedPath,
    messageId: UNREGISTERED_SCOPE_REACH_MESSAGE_ID,
    data: { scope: asked.scope.name, ...step },
  }));
};

export const scopeClosureFindings = (asked: {
  readonly scopes: readonly ScopeRegistration[];
  readonly paths: readonly string[];
  readonly repositoryRoot: string;
}): readonly CoverageFinding[] =>
  asked.scopes.flatMap((scope) =>
    scopeFindings({ scope, paths: asked.paths, repositoryRoot: asked.repositoryRoot }),
  );
