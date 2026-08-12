import {
  INVALID_CANONICAL_DECLARATION_REASONS,
  type InvalidCanonicalDeclarationReason,
} from "./declarations.ts";

import type { CanonicalValuesRepositoryProblem as CanonicalValuesProblem } from "./builder.ts";
import type { CanonicalValuesEntry } from "./catalog.ts";
import type { CanonicalValue } from "./fingerprint.ts";

const invalidReason = (reason: InvalidCanonicalDeclarationReason): string => {
  const descriptions: Readonly<Record<InvalidCanonicalDeclarationReason, string>> = {
    [INVALID_CANONICAL_DECLARATION_REASONS.adjacentDeclarationRequired]:
      "the JSDoc must be followed directly by its declaration without another comment or token in between",
    [INVALID_CANONICAL_DECLARATION_REASONS.identifierBindingRequired]:
      "the annotated variable must bind one identifier",
    [INVALID_CANONICAL_DECLARATION_REASONS.jsdocRequired]:
      "the annotation must be written in a JSDoc block",
    [INVALID_CANONICAL_DECLARATION_REASONS.moduleScopeRequired]:
      "the annotation must be at module scope",
    [INVALID_CANONICAL_DECLARATION_REASONS.runtimeInitializerRequired]:
      "the annotated variable must have a runtime initializer and must not be ambient",
    [INVALID_CANONICAL_DECLARATION_REASONS.singleAnnotationRequired]:
      "the JSDoc must contain exactly one @canonical-values tag",
    [INVALID_CANONICAL_DECLARATION_REASONS.singleBindingRequired]:
      "the annotated variable statement must declare exactly one binding",
    [INVALID_CANONICAL_DECLARATION_REASONS.variableStatementRequired]:
      "the annotation must be attached to a variable statement",
  };
  return descriptions[reason];
};

const sourceProblemMessage = (problem: CanonicalValuesProblem): string | null => {
  if (problem.kind === "unsafe-symbolic-link") {
    return "A symbolic link in the repository source walk must resolve to a readable target inside the repository. Replace the broken or external link with a repository-owned source path.";
  }
  if (problem.kind === "retired-annotation-tag") {
    return `The retired annotation tag ${problem.tag} must not stay in the source, because opting a value set out of the canonical vocabulary is no longer possible. Delete the tag, and declare the concept it belonged to so every use derives from that declaration.`;
  }
  if (problem.kind === "canonical-rule-suppression") {
    return "Canonical vocabulary rules must not be suppressed with a lint-disable directive. Delete the directive, then derive the use site from its registered runtime owner or register the missing owner.";
  }
  if (problem.kind === "unparsable-annotation") {
    return 'A canonical values annotation must name the concept it declares. Write the tag followed by a concept id built from lowercase words joined by "-" or ".".';
  }
  return problem.kind === "unparsable-source"
    ? "A source containing a canonical values annotation must parse successfully before it can declare an owner. Fix the source syntax or delete the annotation."
    : null;
};

const declarationProblemMessage = (problem: CanonicalValuesProblem): string | null => {
  if (problem.kind === "invalid-declaration") {
    return `A canonical values annotation does not declare an owner here: ${invalidReason(problem.reason)}. Move it onto one module-scope variable statement with one identifier binding, or delete it.`;
  }
  if (problem.kind === "out-of-scope-declaration") {
    return `${problem.conceptId} is annotated in a non-production source. Move the canonical owner into production source, or delete the annotation.`;
  }
  if (problem.kind === "vocabulary-without-values") {
    return `A canonical values annotation must sit on a variable whose resolved type exposes only finite string, number, boolean, or null values for ${problem.conceptId}. Make the binding expose that literal domain, or delete the annotation.`;
  }
  return problem.kind === "duplicate-concept"
    ? `A concept must be declared in one place. ${problem.conceptId} is already declared at ${problem.declaredFilePath}:${problem.declaredLine}. Delete one of the two declarations, and derive from the one that stays.`
    : null;
};

export const formatCanonicalValuesProblem = (problem: CanonicalValuesProblem): string => {
  const location = `${problem.filePath}:${problem.line}`;
  const sourceMessage = sourceProblemMessage(problem);
  if (sourceMessage !== null) return `${location} ${sourceMessage}`;
  const declarationMessage = declarationProblemMessage(problem);
  if (declarationMessage !== null) return `${location} ${declarationMessage}`;
  throw new Error(`Unsupported canonical values problem: ${problem.kind}`);
};

const formatValues = (values: readonly CanonicalValue[]): string =>
  [...new Set(values.map((value) => JSON.stringify(value)))].toSorted().join(", ");

export const formatEquivalentConceptGroup = (group: readonly CanonicalValuesEntry[]): string => {
  const declarations = group
    .map((entry) => `${entry.conceptId} (${entry.declarationPath})`)
    .join(", ");
  return `${formatValues(group.flatMap((entry) => entry.values))} is declared by more than one concept: ${declarations}`;
};
