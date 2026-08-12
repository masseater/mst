import {
  type CanonicalValuePrimitiveTypeEnvironment,
  type CanonicalValuePrimitiveTypeResolution,
} from "./canonical-value-primitive-type-context.ts";
import {
  canonicalValueTypeAliasSubstitutions,
  canonicalValueTypeReferenceSubstitution,
} from "./canonical-value-type-alias.ts";

import type { ESTree } from "@oxlint/plugins";

export const resolveCanonicalValuePrimitiveTypeReference = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CanonicalValuePrimitiveTypeResolution & { readonly type: ESTree.TSTypeReference },
): CanonicalValuePrimitiveTypeResolution | null => {
  const substitution = canonicalValueTypeReferenceSubstitution(input);
  if (substitution !== null) return { ...input, type: substitution };
  if (input.type.typeName.type !== "Identifier") return null;
  const alias = environment.aliases.lexical({ name: input.type.typeName.name, node: input.type });
  return alias === null
    ? null
    : {
        ...input,
        substitutions: canonicalValueTypeAliasSubstitutions({
          alias,
          inherited: input.substitutions,
          reference: input.type,
        }),
        type: alias.typeAnnotation,
      };
};
