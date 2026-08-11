import { dirname, join, resolve } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { isFile } from "../lib/canonical-values/source-files.ts";
import { assetsNameMarkersFrom, assetsStemOf } from "../lib/spec-syntax/assets-files.ts";
import { specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";

import type { ESTree } from "@oxlint/plugins";

const unownedAssetsNamesIn = (
  assetsPath: string,
  {
    markers,
    specSuffixes,
  }: { readonly markers: ReadonlySet<string>; readonly specSuffixes: readonly string[] },
): string | null => {
  const stem = assetsStemOf(assetsPath, markers);
  if (stem === null) return null;

  const directory = dirname(assetsPath);
  const ownerNames = specSuffixes.map((suffix) => `${stem}${suffix}`);
  if (ownerNames.some((ownerName) => isFile(join(directory, ownerName)))) return null;

  return ownerNames.map((ownerName) => `\`${ownerName}\``).join(" or ");
};

export const requireSpecFileForAssets = createDontReviewItRule({
  name: "require-spec-file-for-assets--create-matching-spec",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every test data file to sit beside a spec of the same stem, so the data has one owner that reads it and leaves the repository with the test that gave it a reason to exist",
      relatedGuidelines: [],
    },
    messages: {
      unownedAssets:
        "A test data file must not sit in a directory that holds no spec of its own stem. Nothing named {{ownerNames}} sits beside it. Write the spec that reads this file and name it after the stem this file already carries, or move these values into the spec that reads them and delete this file.",
    },
    schema: [
      {
        type: "object",
        properties: {
          assetsNameMarkers: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const markers = assetsNameMarkersFrom(context.options);
    const specSuffixes = specFileSuffixesFrom(context.options);

    return {
      Program(node: ESTree.Program) {
        const ownerNames = unownedAssetsNamesIn(resolve(context.cwd, context.filename), {
          markers,
          specSuffixes,
        });
        if (ownerNames === null) return;
        context.report({ node, messageId: "unownedAssets", data: { ownerNames } });
      },
    };
  },
});
