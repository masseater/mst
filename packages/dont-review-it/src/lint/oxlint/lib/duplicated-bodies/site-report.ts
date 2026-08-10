import type { ESTree } from "@oxlint/plugins";
import type { BodySite } from "./body-index.ts";

export const spellSites = (sites: readonly BodySite[]): string =>
  sites.map((site) => `${site.relativePath}:${site.line} (${site.name})`).join(", ");

export const statementCovering = (
  statements: ESTree.Program["body"],
  line: number,
): ESTree.Node | null => {
  for (const statement of statements) {
    if (statement.loc.start.line <= line && line <= statement.loc.end.line) return statement;
  }
  return null;
};
