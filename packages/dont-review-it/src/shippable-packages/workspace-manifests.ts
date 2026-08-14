import { readFileSync } from "node:fs";

import { parseTree } from "jsonc-parser";

import { propertyValueOf, type PublishedManifest } from "../intent-skills/manifest.ts";
import { listRepositoryFiles } from "../lint/oxlint/lib/canonical-values/source-files.ts";

export type ShippableWorkspace = {
  readonly manifest: PublishedManifest;
  readonly packageName: string;
  readonly withheld: boolean;
};

export const readShippableWorkspaces = (repositoryRoot: string): readonly ShippableWorkspace[] =>
  listRepositoryFiles(repositoryRoot).manifests.flatMap((file) => {
    const source = readFileSync(file.absolutePath, "utf8");
    const root = parseTree(source);
    if (root === undefined) return [];

    const packageName = propertyValueOf(root, "name");
    if (typeof packageName !== "string") return [];

    return [
      {
        manifest: { file, source, root },
        packageName,
        withheld: propertyValueOf(root, "private") === true,
      },
    ];
  });
