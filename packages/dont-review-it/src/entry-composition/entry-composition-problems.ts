import { findNodeAtLocation, type Node } from "jsonc-parser";

import { composedPrefixOf, type EntryCompositionConfig } from "./config.ts";
import { readEntryManifests, type EntryManifest } from "./entry-manifests.ts";

import type { RepositoryProblem } from "../problem.ts";

export type EntryCompositionReport = {
  readonly problems: readonly RepositoryProblem[];
  readonly failures: readonly string[];
};

export type EntryFinding =
  | { readonly kind: "missing-scripts"; readonly entryName: string }
  | { readonly kind: "missing-entry"; readonly entryName: string; readonly node: Node }
  | {
      readonly kind: "prefix-mismatch";
      readonly entryName: string;
      readonly value: string;
      readonly node: Node;
    };

export const entryFindingsIn = ({
  manifest,
  config,
}: {
  readonly manifest: EntryManifest;
  readonly config: EntryCompositionConfig;
}): readonly EntryFinding[] => {
  const { layer } = manifest;
  const scriptsNode = findNodeAtLocation(manifest.root, [config.scriptsKey]);
  if (scriptsNode === undefined) {
    return layer.required
      ? layer.entryNames.map((entryName): EntryFinding => ({ kind: "missing-scripts", entryName }))
      : [];
  }

  const prefix = composedPrefixOf({ layer, config });
  return layer.entryNames.flatMap((entryName): readonly EntryFinding[] => {
    const scriptNode = findNodeAtLocation(manifest.root, [config.scriptsKey, entryName]);
    if (scriptNode === undefined) {
      return layer.required ? [{ kind: "missing-entry", entryName, node: scriptsNode }] : [];
    }
    const scriptText = typeof scriptNode.value === "string" ? scriptNode.value : "";
    return scriptText.startsWith(prefix)
      ? []
      : [{ kind: "prefix-mismatch", entryName, value: scriptText, node: scriptNode }];
  });
};

const lineAt = ({ source, offset }: { readonly source: string; readonly offset: number }): number =>
  source.slice(0, offset).split("\n").length;

const problemOf = ({
  manifest,
  finding,
  config,
}: {
  readonly manifest: EntryManifest;
  readonly finding: EntryFinding;
  readonly config: EntryCompositionConfig;
}): RepositoryProblem => {
  const prefix = composedPrefixOf({ layer: manifest.layer, config });
  if (finding.kind === "missing-scripts") {
    return {
      file: manifest.relativePath,
      line: null,
      message: `The scripts section holding the required "${finding.entryName}" entry must not be missing. Add a scripts section whose "${finding.entryName}" value starts with "${prefix}".`,
    };
  }
  if (finding.kind === "missing-entry") {
    return {
      file: manifest.relativePath,
      line: lineAt({ source: manifest.source, offset: finding.node.offset }),
      message: `The required "${finding.entryName}" script must not be missing. Add "${finding.entryName}" with a value that starts with "${prefix}".`,
    };
  }
  return {
    file: manifest.relativePath,
    line: lineAt({ source: manifest.source, offset: finding.node.offset }),
    message: `The "${finding.entryName}" script must not start with "${finding.value.slice(0, prefix.length)}". Rewrite the value to start with the required prefix "${prefix}".`,
  };
};

export const entryCompositionProblems = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: EntryCompositionConfig;
}): EntryCompositionReport => {
  const listing = readEntryManifests({ repositoryRoot, config });
  return {
    problems: listing.manifests.flatMap((manifest) =>
      entryFindingsIn({ manifest, config }).map((finding) =>
        problemOf({ manifest, finding, config }),
      ),
    ),
    failures: listing.failures,
  };
};
