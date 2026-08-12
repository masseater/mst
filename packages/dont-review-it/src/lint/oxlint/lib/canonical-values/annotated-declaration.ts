import { declarationEntriesAt } from "./declaration-path.ts";
import { scanCanonicalValuesText } from "./declarations.ts";

import type { CanonicalValuesCatalog } from "./catalog.ts";
import type { CanonicalValue } from "./fingerprint.ts";

export type AnnotatedDeclarationRange = {
  readonly binding: string;
  readonly conceptId: string;
  readonly fingerprint: string;
  readonly start: number;
  readonly end: number;
  readonly values: readonly CanonicalValue[];
};

export const registeredDeclarationRanges = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly filename: string;
  readonly repositoryRoot: string;
  readonly sourceText: string;
}): readonly AnnotatedDeclarationRange[] => {
  const declarations = scanCanonicalValuesText(input.sourceText, input.filename).declarations;
  return declarationEntriesAt(input.catalog, {
    path: input.filename,
    repositoryRoot: input.repositoryRoot,
  }).flatMap((catalogDeclaration) => {
    const matchesCurrentSource = declarations.some(
      (declaration) =>
        declaration.annotationStart === catalogDeclaration.annotationStart &&
        declaration.binding === catalogDeclaration.binding &&
        declaration.bindingStart === catalogDeclaration.bindingStart &&
        declaration.conceptId === catalogDeclaration.conceptId &&
        declaration.declarationStart === catalogDeclaration.declarationStart &&
        declaration.declarationEnd === catalogDeclaration.declarationEnd,
    );
    if (!matchesCurrentSource) return [];
    return [
      {
        binding: catalogDeclaration.binding,
        conceptId: catalogDeclaration.conceptId,
        fingerprint: catalogDeclaration.fingerprint,
        start: catalogDeclaration.declarationStart,
        end: catalogDeclaration.declarationEnd,
        values: catalogDeclaration.values,
      },
    ];
  });
};
