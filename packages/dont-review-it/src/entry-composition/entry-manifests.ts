import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalize } from "node:path/posix";

import { readUnlessMissing } from "@mst/repository-checks";
import { attempt, uniq } from "es-toolkit";
import { parseTree, type Node, type ParseError } from "jsonc-parser";
import { parse } from "yaml";

import { directoriesMatching } from "../dependency-catalog/manifest-files.ts";
import { recordOf } from "../dependency-catalog/record-fields.ts";

import type { EntryCompositionConfig, EntryCompositionLayer } from "./config.ts";

export type EntryManifest = {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly source: string;
  readonly root: Node;
  readonly layer: EntryCompositionLayer;
};

export type EntryManifestListing = {
  readonly manifests: readonly EntryManifest[];
  readonly failures: readonly string[];
};

const readOutcomeOf = (
  absolutePath: string,
):
  | { readonly kind: "missing" }
  | { readonly kind: "unreadable" }
  | { readonly kind: "read"; readonly source: string } => {
  const [unreadable, source] = attempt<string | null, Error>(() =>
    readUnlessMissing(() => readFileSync(absolutePath, "utf8")),
  );
  if (unreadable !== null) return { kind: "unreadable" };
  return source === null ? { kind: "missing" } : { kind: "read", source };
};

const unreadableFailureOf = (relativePath: string): string =>
  `${relativePath} exists but cannot be read, so the entry composition check did not run.`;

const EMPTY_LISTING: EntryManifestListing = { manifests: [], failures: [] };

const manifestListingAt = ({
  repositoryRoot,
  relativePath,
  layer,
}: {
  readonly repositoryRoot: string;
  readonly relativePath: string;
  readonly layer: EntryCompositionLayer;
}): EntryManifestListing => {
  const absolutePath = join(repositoryRoot, relativePath);
  const manifestRead = readOutcomeOf(absolutePath);
  if (manifestRead.kind === "missing") return EMPTY_LISTING;
  if (manifestRead.kind === "unreadable") {
    return { manifests: [], failures: [unreadableFailureOf(relativePath)] };
  }

  const errors: ParseError[] = [];
  const tree = parseTree(manifestRead.source, errors);
  return tree !== undefined && errors.length === 0 && tree.type === "object"
    ? {
        manifests: [{ relativePath, absolutePath, source: manifestRead.source, root: tree, layer }],
        failures: [],
      }
    : {
        manifests: [],
        failures: [
          `${relativePath} exists but does not parse as a JSON object, so the entry composition check did not run.`,
        ],
      };
};

const workspaceDirectoriesOf = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: EntryCompositionConfig;
}): { readonly directories: readonly string[]; readonly failures: readonly string[] } => {
  const definitionRead = readOutcomeOf(join(repositoryRoot, config.workspaceDefinitionFileName));
  if (definitionRead.kind === "missing") return { directories: [], failures: [] };
  if (definitionRead.kind === "unreadable") {
    return { directories: [], failures: [unreadableFailureOf(config.workspaceDefinitionFileName)] };
  }

  const [unparsable, definition] = attempt<unknown, Error>(() => parse(definitionRead.source));
  if (unparsable !== null) {
    return {
      directories: [],
      failures: [
        `${config.workspaceDefinitionFileName} exists but does not parse as YAML, so the entry composition check did not run.`,
      ],
    };
  }

  const declaredPatterns = recordOf(definition)[config.workspacePatternsKey];
  const patterns = Array.isArray(declaredPatterns)
    ? declaredPatterns.filter((pattern): pattern is string => typeof pattern === "string")
    : [];
  return {
    directories: uniq(
      patterns.flatMap((pattern) => directoriesMatching({ repositoryRoot, pattern })),
    ).toSorted(),
    failures: [],
  };
};

export const readEntryManifests = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: EntryCompositionConfig;
}): EntryManifestListing => {
  const expansion = workspaceDirectoriesOf({ repositoryRoot, config });
  const workspacePaths = expansion.directories
    .map((directory) => normalize(`${directory}/${config.manifestFileName}`))
    .filter((relativePath) => relativePath !== config.manifestFileName);
  const listings = [
    manifestListingAt({
      repositoryRoot,
      relativePath: config.manifestFileName,
      layer: config.rootLayer,
    }),
    ...workspacePaths.map((relativePath) =>
      manifestListingAt({ repositoryRoot, relativePath, layer: config.workspaceLayer }),
    ),
  ];

  return {
    manifests: listings.flatMap((listing) => listing.manifests),
    failures: [
      ...expansion.failures,
      ...listings.flatMap((listing) => listing.failures),
    ].toSorted(),
  };
};
