import { relative, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import {
  namedFingerprintOf,
  type BodyIndex,
  type BodyIndexLoader,
} from "../lib/duplicated-bodies/body-index.ts";
import { spellSites, statementCovering } from "../lib/duplicated-bodies/site-report.ts";
import { isOutOfScopeSource } from "../lib/out-of-scope-source.ts";
import { toPosixPath } from "../lib/posix-path.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { ESTree } from "@oxlint/plugins";

const twinReports = (input: {
  readonly index: BodyIndex;
  readonly relativePath: string;
}): readonly { readonly line: number; readonly sites: string }[] => {
  const { index, relativePath } = input;
  return (index.bodiesByPath.get(relativePath) ?? []).flatMap((body) => {
    const elsewhere = (index.sitesByNamedFingerprint.get(namedFingerprintOf(body)) ?? []).filter(
      (site) => site.relativePath !== relativePath || site.line !== body.line,
    );
    return elsewhere.length === 0 ? [] : [{ line: body.line, sites: spellSites(elsewhere) }];
  });
};

export const createNoTwinDeclaration = ({
  loadIndex,
}: {
  readonly loadIndex: BodyIndexLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "no-twin-declaration--merge-into-one-owner",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow a declaration that another declaration in the repository spells with the same name and the same body, so one concept keeps one owner however small the body is",
        relatedGuidelines: [],
      },
      messages: {
        twinDeclaration:
          "A declaration must not carry both the name and the body of another declaration in this repository. The same declaration stands at {{sites}}. Decide which module owns the concept, export it from there, and import it everywhere else.",
      },
      schema: [],
    },
    create(context) {
      if (isOutOfScopeSource(context.filename)) return {};

      const repositoryRootOf = memoize((): string => findWorkspaceRoot(context.cwd));

      return {
        Program(node: ESTree.Program) {
          const repositoryRoot = repositoryRootOf();
          const relativePath = toPosixPath(relative(repositoryRoot, resolve(context.filename)));
          const reports = twinReports({
            index: loadIndex({ repositoryRoot }),
            relativePath,
          });

          for (const report of reports) {
            context.report({
              node: statementCovering(node.body, report.line) ?? node,
              messageId: "twinDeclaration",
              data: { sites: report.sites },
            });
          }
        },
      };
    },
  });
