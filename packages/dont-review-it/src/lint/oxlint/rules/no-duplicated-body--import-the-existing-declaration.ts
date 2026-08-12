import { relative, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { spellSites, statementCovering } from "../lib/duplicated-bodies/site-report.ts";
import { isOutOfScopeSource } from "../lib/out-of-scope-source.ts";
import { toPosixPath } from "../lib/posix-path.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { ESTree } from "@oxlint/plugins";
import type { BodyIndex, BodyIndexLoader } from "../lib/duplicated-bodies/body-index.ts";

const duplicatedBodyReports = (input: {
  readonly index: BodyIndex;
  readonly relativePath: string;
}): readonly { readonly line: number; readonly sites: string }[] => {
  const { index, relativePath } = input;
  return (index.bodiesByPath.get(relativePath) ?? []).flatMap((writtenBody) => {
    const elsewhere = (index.sitesByFingerprint.get(writtenBody.fingerprint) ?? []).filter(
      (site) => site.relativePath !== relativePath || site.line !== writtenBody.line,
    );
    return elsewhere.length === 0 ? [] : [{ line: writtenBody.line, sites: spellSites(elsewhere) }];
  });
};

export const createNoDuplicatedBody = ({
  loadIndex,
}: {
  readonly loadIndex: BodyIndexLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "no-duplicated-body--import-the-existing-declaration",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow a declaration whose body is spelled exactly as another declaration elsewhere in the repository, so one behaviour keeps one owner instead of drifting between copies",
        relatedGuidelines: [],
      },
      messages: {
        duplicatedBody:
          "A declaration must not repeat a body that already exists elsewhere in this repository. The same body is declared at {{sites}}. Decide which module owns the behaviour, export it from there, and import it everywhere else.",
      },
      schema: [],
    },
    create(inspection) {
      if (isOutOfScopeSource(inspection.filename)) return {};

      const repositoryRootOf = memoize((): string => findWorkspaceRoot(inspection.cwd));

      return {
        Program(node: ESTree.Program) {
          const repositoryRoot = repositoryRootOf();
          const relativePath = toPosixPath(relative(repositoryRoot, resolve(inspection.filename)));
          const reports = duplicatedBodyReports({
            index: loadIndex({ repositoryRoot }),
            relativePath,
          });

          for (const report of reports) {
            inspection.report({
              node: statementCovering(node.body, report.line) ?? node,
              messageId: "duplicatedBody",
              data: { sites: report.sites },
            });
          }
        },
      };
    },
  });
