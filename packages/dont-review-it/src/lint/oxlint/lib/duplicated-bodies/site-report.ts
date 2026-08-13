import type { ESTree } from "@oxlint/plugins";
import type { BodySite } from "./body-index.ts";

export const spellSites = (sites: readonly BodySite[]): string =>
  sites.map((site) => `${site.relativePath}:${site.line} (${site.name})`).join(", ");

export const formatDuplicatedCluster = (sites: readonly BodySite[]): string =>
  `${spellSites(sites)} A body must not be spelled the same way in more than one declaration, because a fix applied to one of them leaves the others behind. Keep one of these declarations, and import it at the places that repeat it.`;

export const statementCovering = (
  statements: ESTree.Program["body"],
  line: number,
): ESTree.Node | null => {
  for (const statement of statements) {
    if (statement.loc.start.line <= line && line <= statement.loc.end.line) return statement;
  }
  return null;
};
