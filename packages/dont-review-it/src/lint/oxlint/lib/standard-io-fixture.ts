import { importedNameOf } from "./imported-binding.ts";

import type { ESTree } from "@oxlint/plugins";

const STANDARD_IO_FIXTURE_NAME = "standardIoTest";

export const standardIoFixtureLocalNameOf = (node: ESTree.ImportDeclaration): string | null => {
  const specifier = node.specifiers.find(
    (candidate) =>
      candidate.type === "ImportSpecifier" &&
      importedNameOf(candidate) === STANDARD_IO_FIXTURE_NAME,
  );
  return specifier === undefined ? null : specifier.local.name;
};
