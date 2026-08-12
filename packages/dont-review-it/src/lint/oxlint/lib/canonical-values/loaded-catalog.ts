import { resolve } from "node:path";

import { memoize } from "es-toolkit";

import { buildCanonicalValuesCatalog } from "./builder.ts";

import type { CanonicalValuesCatalog } from "./catalog.ts";

const catalogAt = memoize(
  (repositoryRoot: string): CanonicalValuesCatalog =>
    buildCanonicalValuesCatalog({ repositoryRoot }),
);

export const loadCanonicalValuesCatalog = (options: {
  readonly repositoryRoot: string;
}): CanonicalValuesCatalog => catalogAt(resolve(options.repositoryRoot));
