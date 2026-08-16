import { forbidNumberedSiblingFile } from "../../lint/oxlint/rules/writing/forbid-numbered-sibling-file--name-what-each-file-owns.ts";
import { forbidOversizedFile } from "../../lint/oxlint/rules/writing/forbid-oversized-file--split-by-responsibility.ts";
import { forbidUnresolvableModuleSpecifier } from "../../lint/oxlint/rules/writing/forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier.ts";
import { noAmbiguousVariableName } from "../../lint/oxlint/rules/writing/no-ambiguous-variable-name--rename-to-concrete-noun.ts";
import { noCittyParentRun } from "../../lint/oxlint/rules/writing/no-citty-parent-run--move-run-into-a-subcommand.ts";
import { noDefaultExport } from "../../lint/oxlint/rules/writing/no-default-export--use-named-export.ts";
import { noDetachedDeclaration } from "../../lint/oxlint/rules/writing/no-detached-declaration--declare-it-next-to-its-use.ts";
import { noDetachedRationale } from "../../lint/oxlint/rules/writing/no-detached-rationale--comment-at-explained-line.ts";
import { noDoubleTypeAssertion } from "../../lint/oxlint/rules/writing/no-double-type-assertion--declare-the-real-type.ts";
import { noExplanatoryComment } from "../../lint/oxlint/rules/writing/no-explanatory-comment--delete-or-move-to-commit-message.ts";
import { noHardcodedEndpoint } from "../../lint/oxlint/rules/writing/no-hardcoded-endpoint--read-from-configuration.ts";
import { noHardcodedProviderId } from "../../lint/oxlint/rules/writing/no-hardcoded-provider-id--read-from-configuration.ts";
import { noIdentityWrapper } from "../../lint/oxlint/rules/writing/no-identity-wrapper--call-the-target-directly.ts";
import { noMultiBindingDeclaration } from "../../lint/oxlint/rules/writing/no-multi-binding-declaration--declare-one-binding-per-statement.ts";
import { noSingleUseLocalType } from "../../lint/oxlint/rules/writing/no-single-use-local-type--inline-at-the-use-site.ts";
import { noUncheckedCast } from "../../lint/oxlint/rules/writing/no-unchecked-cast--parse-at-boundary.ts";
import { noUnorderedImport } from "../../lint/oxlint/rules/writing/no-unordered-import--group-by-origin-then-sort-by-specifier.ts";
import { requireReExportOnlyFiles } from "../../lint/oxlint/rules/writing/require-re-export-only-files--move-declaration-to-owning-module.ts";
import { noUnusedStyleClass } from "../../plugin.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";

export const writingBundle: readonly WorkspaceLintRule[] = [
  forbidNumberedSiblingFile,
  forbidOversizedFile,
  forbidUnresolvableModuleSpecifier,
  noAmbiguousVariableName,
  noCittyParentRun,
  noDefaultExport,
  noDetachedDeclaration,
  noDetachedRationale,
  noDoubleTypeAssertion,
  noExplanatoryComment,
  noHardcodedEndpoint,
  noHardcodedProviderId,
  noIdentityWrapper,
  noMultiBindingDeclaration,
  noSingleUseLocalType,
  noUncheckedCast,
  noUnorderedImport,
  noUnusedStyleClass,
  requireReExportOnlyFiles,
];
