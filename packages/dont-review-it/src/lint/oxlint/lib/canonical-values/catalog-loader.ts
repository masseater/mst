import type { CanonicalValuesCatalog } from "./catalog.ts";

export type CanonicalValuesCatalogLoader = (options: {
  readonly repositoryRoot: string;
}) => CanonicalValuesCatalog;
