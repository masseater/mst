import { forbidTrackedPath } from "../../lint/oxlint/rules/toolchain/forbid-tracked-path--untrack-and-ignore.ts";
import { noStandaloneTsconfig } from "../../lint/oxlint/rules/toolchain/no-standalone-tsconfig--extend-shared-preset.ts";
import { noUncheckedAuthoredPath } from "../../lint/oxlint/rules/toolchain/no-unchecked-authored-path--include-it-in-every-declared-check.ts";
import { requireRegisteredFile } from "../../lint/oxlint/rules/toolchain/require-registered-file--restore-it-at-the-registered-path.ts";
import { noVersionRange, requireCatalogEntry } from "../../plugin.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";

export const toolchainBundle: readonly WorkspaceLintRule[] = [
  forbidTrackedPath,
  noStandaloneTsconfig,
  noUncheckedAuthoredPath,
  noVersionRange,
  requireCatalogEntry,
  requireRegisteredFile,
];
