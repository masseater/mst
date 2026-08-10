import { loadCanonicalValuesCatalog } from "./lint/oxlint/lib/canonical-values/builder.ts";
import { loadLibraryVocabulary } from "./lint/oxlint/lib/library-vocabulary/harvester.ts";
import { forbidOversizedFile } from "./lint/oxlint/rules/forbid-oversized-file--split-by-responsibility.ts";
import { noAmbiguousVariableName } from "./lint/oxlint/rules/no-ambiguous-variable-name--rename-to-concrete-noun.ts";
import { noDefaultExport } from "./lint/oxlint/rules/no-default-export--use-named-export.ts";
import { noDetachedRationale } from "./lint/oxlint/rules/no-detached-rationale--comment-at-explained-line.ts";
import { noDetachedTestFile } from "./lint/oxlint/rules/no-detached-test-file--move-beside-source.ts";
import { noExplanatoryComment } from "./lint/oxlint/rules/no-explanatory-comment--delete-or-move-to-commit-message.ts";
import { createNoLocalFiniteValueSet } from "./lint/oxlint/rules/no-local-finite-value-set--use-or-register-canonical-values.ts";
import { createNoStrictCanonicalLiteralUseRule } from "./lint/oxlint/rules/no-strict-canonical-literal-use--use-canonical-import.ts";
import { requireReExportOnlyFiles } from "./lint/oxlint/rules/require-re-export-only-files--move-declaration-to-owning-module.ts";

import type { Plugin } from "@oxlint/plugins";

export const noLocalFiniteValueSet = createNoLocalFiniteValueSet({
  loadCatalog: loadCanonicalValuesCatalog,
  loadLibraryVocabulary,
});

export const noStrictCanonicalLiteralUse = createNoStrictCanonicalLiteralUseRule({
  loadCatalog: loadCanonicalValuesCatalog,
});

const plugin: Plugin = {
  meta: { name: "dont-review-it" },
  rules: {
    [forbidOversizedFile.name]: forbidOversizedFile,
    [noAmbiguousVariableName.name]: noAmbiguousVariableName,
    [noDefaultExport.name]: noDefaultExport,
    [noDetachedRationale.name]: noDetachedRationale,
    [noDetachedTestFile.name]: noDetachedTestFile,
    [noExplanatoryComment.name]: noExplanatoryComment,
    [noLocalFiniteValueSet.name]: noLocalFiniteValueSet,
    [noStrictCanonicalLiteralUse.name]: noStrictCanonicalLiteralUse,
    [requireReExportOnlyFiles.name]: requireReExportOnlyFiles,
  },
};

export default plugin;
