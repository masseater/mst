import * as ts from "typescript-6";

import { canonicalOwnerIsMutated } from "./canonical-owner-mutation.ts";
import { canonicalOwnerBindingTypeIsReadonly } from "./canonical-owner-readonly.ts";

export const validateCanonicalOwnerStability = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.VariableDeclaration;
  readonly nodes: readonly ts.Node[];
  readonly owner: ts.Symbol;
  readonly program: ts.Program;
}): void => {
  if (!canonicalOwnerBindingTypeIsReadonly(input)) {
    throw new Error(`${input.declaration.name.getText()}: canonical owner must be readonly`);
  }
  const ownerType = input.checker.getTypeAtLocation(input.declaration.name);
  const ownerIsArray =
    input.checker.getIndexTypeOfType(ownerType, ts.IndexKind.Number) !== undefined;
  if (canonicalOwnerIsMutated({ ...input, ownerIsArray })) {
    throw new Error(`${input.declaration.name.getText()}: canonical owner must not be mutated`);
  }
};
