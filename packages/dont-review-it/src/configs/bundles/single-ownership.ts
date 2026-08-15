import {
  noDuplicateValueDeclaration,
  noDuplicatedBody,
  noLocalFiniteValueSet,
  noSplitTypeAuthority,
  noStrictCanonicalLiteralUse,
  noTwinDeclaration,
} from "../../plugin.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";

export const singleOwnershipBundle: readonly WorkspaceLintRule[] = [
  noDuplicateValueDeclaration,
  noDuplicatedBody,
  noLocalFiniteValueSet,
  noSplitTypeAuthority,
  noStrictCanonicalLiteralUse,
  noTwinDeclaration,
];
