import { zip } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodeVisitsOfType } from "../lib/nodes-of-type.ts";
import {
  entryKeysOf,
  INLINE_SPELLING_BY_EXTERNAL,
  snapshotMatcherSiteOf,
  type SnapshotEntryKeys,
  type SnapshotMatcherSite,
} from "../lib/spec-syntax/snapshot-entry-keys.ts";
import {
  externalRecordOf,
  MAX_INLINE_RECORD_LINES,
  recordLineCountOf,
} from "../lib/spec-syntax/snapshot-records.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";

import type { ESTree, Options, Range } from "@oxlint/plugins";

const MAX_LINES_OPTION = "maxLines";

const REPORTED_KEY_LIMIT = 3;

const maxLinesFrom = (options: Readonly<Options>): number => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return MAX_INLINE_RECORD_LINES;
  }
  const configured = first[MAX_LINES_OPTION];
  return typeof configured === "number" ? configured : MAX_INLINE_RECORD_LINES;
};

const spelledKeys = (keys: readonly string[]): string =>
  keys.length <= REPORTED_KEY_LIMIT
    ? keys.join("`, `")
    : `${keys.slice(0, REPORTED_KEY_LIMIT).join("`, `")}\` and ${String(keys.length - REPORTED_KEY_LIMIT)} more\``;

export const noUndersizedExternalSnapshot = createDontReviewItRule({
  name: "no-undersized-external-snapshot--use-inline-snapshot",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow an external snapshot whose recorded value fits within the shared inline budget, so where a recorded value lives follows from its size rather than from the taste of whoever wrote the assertion",
      relatedGuidelines: [],
    },
    messages: {
      undersizedExternalSnapshot:
        "A recorded value of {{recordedLines}} lines must not sit in an external snapshot file against a shared budget of {{maxLines}} lines for a value that belongs beside its assertion. Replace `{{matcher}}` with `{{inlineSpelling}}`, drop any snapshot hint, and rerun the suite with snapshot updating turned on to carry the value at `{{key}}` into this spec.",
      undersizedTableDrivenSnapshot:
        "A recorded value of {{recordedLines}} lines must not sit in an external snapshot file against a shared budget of {{maxLines}} lines for a value that belongs beside its assertion. Split this table-driven declaration into one test block per case, replace `{{matcher}}` with `{{inlineSpelling}}` in each block, and rerun the suite with snapshot updating turned on to carry the values at `{{key}}` into this spec.",
      unresolvableExternalSnapshot:
        "An external snapshot must not be recorded under a key that cannot be spelled out from this spec alone. Write every enclosing title as a literal string, write the snapshot hint as a literal string, and lift this call out of the loop, branch or nested callback that hides its position among the recorded values.",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxLines: { type: "integer", minimum: 1 },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    fixable: "code",
  },
  create(context) {
    if (!isSpecFile(context.filename, specFileSuffixesFrom(context.options))) return {};

    const maxLines = maxLinesFrom(context.options);

    const recordedLinesOf = (keys: readonly string[]): number | null => {
      const recorded = keys.map((key) => externalRecordOf(context.filename, key));
      const found = recorded.flatMap((record) => (record === null ? [] : [record]));
      if (found.length === 0 || found.length !== recorded.length) return null;
      return Math.max(...found.map(recordLineCountOf));
    };

    const replacementOf = (
      site: SnapshotMatcherSite,
      inlineSpelling: string,
    ): { readonly range: Range; readonly written: string } | null => {
      if (site.node.arguments.length === 0) {
        return { range: [site.matcherNode.start, site.matcherNode.end], written: inlineSpelling };
      }
      if (site.node.arguments.length !== 1 || site.hintNode === null) return null;
      return { range: [site.matcherNode.start, site.node.end], written: `${inlineSpelling}()` };
    };

    const reportUndersized = ({
      site,
      inlineSpelling,
      keys,
    }: {
      readonly site: SnapshotMatcherSite;
      readonly inlineSpelling: string;
      readonly keys: readonly string[];
    }): void => {
      const recordedLines = recordedLinesOf(keys);
      if (recordedLines === null || recordedLines > maxLines) return;

      const measured = {
        recordedLines,
        maxLines,
        matcher: site.matcher,
        inlineSpelling,
        key: spelledKeys(keys),
      };
      if (keys.length > 1) {
        context.report({
          node: site.matcherNode,
          messageId: "undersizedTableDrivenSnapshot",
          data: measured,
        });
        return;
      }

      const replaced = replacementOf(site, inlineSpelling);
      context.report({
        node: site.matcherNode,
        messageId: "undersizedExternalSnapshot",
        data: measured,
        fix:
          replaced === null
            ? undefined
            : (fixer) => fixer.replaceTextRange(replaced.range, replaced.written),
      });
    };

    const reportSite = (site: SnapshotMatcherSite, entries: SnapshotEntryKeys): void => {
      const inlineSpelling = INLINE_SPELLING_BY_EXTERNAL.get(site.matcher);
      if (inlineSpelling === undefined) return;
      if (entries.kind === "unreadable") return;
      if (entries.kind === "unresolvable") {
        context.report({ node: site.matcherNode, messageId: "unresolvableExternalSnapshot" });
        return;
      }
      if (entries.keys.length === 0) return;
      reportUndersized({ site, inlineSpelling, keys: entries.keys });
    };

    return {
      "Program:exit"(program: ESTree.Program) {
        const sites = nodeVisitsOfType(program, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        );
        for (const [site, entries] of zip(sites, entryKeysOf(sites))) {
          reportSite(site, entries);
        }
      },
    };
  },
});
