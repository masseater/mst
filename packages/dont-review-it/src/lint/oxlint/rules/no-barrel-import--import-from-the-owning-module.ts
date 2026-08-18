import { posix } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { importCarriesValues, reExportCarriesValues } from "../lib/carried-values.ts";

import type { ESTree } from "@oxlint/plugins";

const RE_EXPORT_MODULE_STEM = "index";

const RELATIVE_PREFIXES: readonly string[] = ["./", "../"];

const DIRECTORY_SEGMENTS: readonly string[] = [".", ".."];

const isRelativeSpecifier = (specifier: string): boolean =>
  DIRECTORY_SEGMENTS.includes(specifier) ||
  RELATIVE_PREFIXES.some((prefix) => specifier.startsWith(prefix));

const namesReExportModule = (specifier: string): boolean => {
  if (!isRelativeSpecifier(specifier)) return false;
  if (specifier.endsWith(posix.sep)) return true;
  if (DIRECTORY_SEGMENTS.includes(posix.basename(specifier))) return true;
  return posix.basename(specifier, posix.extname(specifier)) === RE_EXPORT_MODULE_STEM;
};

const writtenSpecifierOf = (source: ESTree.Node): string | null => {
  if (source.type !== "Literal") return null;
  return typeof source.value === "string" ? source.value : null;
};

export const noBarrelImport = createDontReviewItRule({
  name: "no-barrel-import--import-from-the-owning-module",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a module specifier that names a re-export module while the statement takes a value through it, so the module a binding is taken from is the module that declares it",
      relatedGuidelines: ["docs/guidelines/writing-code.md"],
      shipped: false,
    },
    messages: {
      barrelImport:
        "A module specifier that names a re-export module is forbidden. Name the module that declares the binding this statement takes.",
    },
    schema: [],
  },
  create(inspection) {
    const reportBarrelSpecifier = (source: ESTree.Node): void => {
      const specifier = writtenSpecifierOf(source);
      if (specifier === null) return;
      if (!namesReExportModule(specifier)) return;
      inspection.report({ node: source, messageId: "barrelImport" });
    };

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (!importCarriesValues(node)) return;
        reportBarrelSpecifier(node.source);
      },
      ImportExpression(node: ESTree.ImportExpression) {
        reportBarrelSpecifier(node.source);
      },
      ExportAllDeclaration(node: ESTree.ExportAllDeclaration) {
        if (!reExportCarriesValues(node)) return;
        reportBarrelSpecifier(node.source);
      },
      ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
        if (node.source === null) return;
        if (!reExportCarriesValues(node)) return;
        reportBarrelSpecifier(node.source);
      },
    };
  },
});
