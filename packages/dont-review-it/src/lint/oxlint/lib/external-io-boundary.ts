import { dirname, relative } from "node:path";

import { findWorkspaceRoot } from "./canonical-values/workspace-root.ts";
import { SUBPATH_SEPARATOR } from "./path-segments.ts";
import { toPosixPath } from "./posix-path.ts";
import { couplingEdgesOf, couplingTargetsOf } from "./setup-modules/entry-reachability.ts";
import { publicEntryFilesOf } from "./setup-modules/package-entries.ts";
import { resolveCoupling } from "./setup-modules/specifier-resolution.ts";

export type ExternalIoVocabulary = {
  readonly modules: ReadonlySet<string>;
  readonly packages: ReadonlySet<string>;
};

export type ReplacedModule =
  | { readonly kind: "outsideTheRepository" }
  | { readonly kind: "ownsExternalIo" }
  | { readonly kind: "behindOwnModules"; readonly boundary: string }
  | { readonly kind: "determinedByItsInput" };

const namesExternalIo = (specifier: string, vocabulary: ExternalIoVocabulary): boolean =>
  vocabulary.modules.has(specifier) ||
  [...vocabulary.packages].some(
    (named) => specifier === named || specifier.startsWith(`${named}${SUBPATH_SEPARATOR}`),
  );

const ownsExternalIo = (
  file: string,
  reading: { readonly workspaceRoot: string; readonly vocabulary: ExternalIoVocabulary },
): boolean =>
  couplingEdgesOf(file).some((edge) => namesExternalIo(edge.specifier, reading.vocabulary));

const firstBoundaryUnder = (
  frontier: readonly string[],
  walk: {
    readonly seen: ReadonlySet<string>;
    readonly workspaceRoot: string;
    readonly vocabulary: ExternalIoVocabulary;
  },
): string | null => {
  const fresh = frontier.filter((file) => !walk.seen.has(file));
  if (fresh.length === 0) return null;

  const owning = fresh.toSorted().find((file) => ownsExternalIo(file, walk));
  if (owning !== undefined) return owning;

  const beyond = fresh.flatMap((file) =>
    couplingTargetsOf({ file, workspaceRoot: walk.workspaceRoot }),
  );
  return firstBoundaryUnder(beyond, { ...walk, seen: new Set([...walk.seen, ...fresh]) });
};

const replacedFilesOf = (
  resolved: NonNullable<ReturnType<typeof resolveCoupling>>,
): readonly string[] =>
  resolved.kind === "repositoryFile"
    ? [resolved.path]
    : (publicEntryFilesOf(resolved.packageDirectory) ?? []);

export const replacedModuleAt = (input: {
  readonly specifier: string;
  readonly fromFile: string;
  readonly vocabulary: ExternalIoVocabulary;
}): ReplacedModule => {
  const workspaceRoot = findWorkspaceRoot(dirname(input.fromFile));
  const resolved = resolveCoupling({
    specifier: input.specifier,
    fromFile: input.fromFile,
    workspaceRoot,
  });
  if (resolved === null) return { kind: "outsideTheRepository" };

  const replaced = replacedFilesOf(resolved);
  const walk = { seen: new Set(replaced), workspaceRoot, vocabulary: input.vocabulary };
  if (replaced.some((file) => ownsExternalIo(file, walk))) return { kind: "ownsExternalIo" };

  const boundary = firstBoundaryUnder(
    replaced.flatMap((file) => couplingTargetsOf({ file, workspaceRoot })),
    walk,
  );
  return boundary === null
    ? { kind: "determinedByItsInput" }
    : { kind: "behindOwnModules", boundary: toPosixPath(relative(workspaceRoot, boundary)) };
};
