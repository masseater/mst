import { findNodeAtLocation, getNodeValue, type Node } from "jsonc-parser";

import type { ScannedFile } from "../lint/oxlint/lib/canonical-values/source-files.ts";

export type PublishedManifest = {
  readonly file: ScannedFile;
  readonly source: string;
  readonly root: Node;
};

export const propertyValueOf = (root: Node, named: string): unknown => {
  const node = findNodeAtLocation(root, [named]);
  return node === undefined ? undefined : getNodeValue(node);
};

export const lineOfProperty = ({
  manifest,
  key: named,
}: {
  manifest: PublishedManifest;
  key: string;
}): number => {
  const node = findNodeAtLocation(manifest.root, [named]);
  return manifest.source.slice(0, node?.offset ?? manifest.root.offset).split("\n").length;
};

export const stringEntriesOf = (declared: unknown): readonly string[] | null =>
  Array.isArray(declared)
    ? declared.filter((candidate): candidate is string => typeof candidate === "string")
    : null;
