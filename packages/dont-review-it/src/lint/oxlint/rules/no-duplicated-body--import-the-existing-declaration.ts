import { relative, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { isOutOfScopeSource } from "../lib/out-of-scope-source.ts";
import { toPosixPath } from "../lib/posix-path.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { ESTree } from "@oxlint/plugins";
import type { BodyIndex, BodySite } from "../lib/duplicated-bodies/body-index.ts";

export type BodyIndexLoader = (options: { readonly repositoryRoot: string }) => BodyIndex;

const spellSites = (sites: readonly BodySite[]): string =>
  sites.map((site) => `${site.relativePath}:${site.line} (${site.name})`).join(", ");

const statementCovering = (
  statements: ESTree.Program["body"],
  line: number,
): ESTree.Node | null => {
  for (const statement of statements) {
    if (statement.loc.start.line <= line && line <= statement.loc.end.line) return statement;
  }
  return null;
};

type DuplicatedBodyReport = {
  readonly line: number;
  readonly sites: string;
};

const duplicatedBodyReports = (input: {
  readonly index: BodyIndex;
  readonly relativePath: string;
}): readonly DuplicatedBodyReport[] => {
  const { index, relativePath } = input;
  return (index.bodiesByPath.get(relativePath) ?? []).flatMap((body) => {
    const elsewhere = (index.sitesByFingerprint.get(body.fingerprint) ?? []).filter(
      (site) => site.relativePath !== relativePath || site.line !== body.line,
    );
    return elsewhere.length === 0 ? [] : [{ line: body.line, sites: spellSites(elsewhere) }];
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
          "A declaration must not repeat a body that already exists elsewhere in this repository, because a later change reaches only the copy that was edited and nothing fails until the two spellings disagree at run time. The same body is declared at {{sites}}. Decide which place owns the behaviour, export it from there, and import it everywhere else. Do not settle the choice by which copy came first or which name reads better: choose the module whose responsibility the behaviour belongs to.",
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
          const reports = duplicatedBodyReports({
            index: loadIndex({ repositoryRoot }),
            relativePath,
          });

          for (const report of reports) {
            context.report({
              node: statementCovering(node.body, report.line) ?? node,
              messageId: "duplicatedBody",
              data: { sites: report.sites },
            });
          }
        },
      };
    },
  });
