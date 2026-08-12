import { baseNameOf, configuredSuffixesFrom } from "../file-name-suffixes.ts";

import type { Options } from "@oxlint/plugins";

const DEFAULT_ASSETS_NAME_MARKERS: readonly string[] = ["assets"];

const ASSETS_NAME_MARKERS_OPTION = "assetsNameMarkers";

const NAME_SEPARATOR = ".";

export const assetsNameMarkersFrom = (ruleOptions: Readonly<Options>): ReadonlySet<string> =>
  new Set(
    configuredSuffixesFrom(ruleOptions, {
      optionName: ASSETS_NAME_MARKERS_OPTION,
      carried: DEFAULT_ASSETS_NAME_MARKERS,
    }),
  );

export const assetsStemOf = (filename: string, markers: ReadonlySet<string>): string | null => {
  const parts = baseNameOf(filename).split(NAME_SEPARATOR);
  const marker = parts.at(-2);
  const extension = parts.at(-1);
  if (marker === undefined || extension === undefined || extension.length === 0) return null;
  if (!markers.has(marker)) return null;

  const stem = parts.slice(0, -2).join(NAME_SEPARATOR);
  return stem.length === 0 ? null : stem;
};
