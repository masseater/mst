import { canonicalValueDefinitionIsAmbientVariable } from "./canonical-value-node-source-consumer.ts";

import type { CanonicalValuesCatalog } from "../lib/canonical-values/catalog.ts";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import type { CanonicalValueRouteOrigin } from "./canonical-value-route-origin.ts";

const originHasRuntimeBinding = (input: {
  readonly bindingIndex: Pick<CanonicalValueBindingIndex, "definitionsOf" | "resolveIdentifier">;
  readonly origin: CanonicalValueOrigin;
}): boolean => {
  if (input.origin.kind === "absent" || input.origin.expression.type !== "Identifier") return false;
  const binding = input.bindingIndex.resolveIdentifier(input.origin.expression);
  if (binding === null) return false;
  const definitions = input.bindingIndex.definitionsOf(binding);
  return definitions.length !== 0 && !definitions.every(canonicalValueDefinitionIsAmbientVariable);
};

export const canonicalValueUnregisteredRouteFromUnresolvedOrigin = (input: {
  readonly bindingIndex: Pick<CanonicalValueBindingIndex, "definitionsOf" | "resolveIdentifier">;
  readonly catalog: CanonicalValuesCatalog;
  readonly origin: CanonicalValueOrigin;
}): Extract<CanonicalValueRouteOrigin, { readonly kind: "unregistered" }> | null => {
  if (input.origin.kind === "absent" || input.origin.expression.type !== "Identifier") return null;
  if (originHasRuntimeBinding(input)) return null;
  const importedName = input.origin.expression.name;
  const entries = input.catalog.entries.filter((entry) => entry.binding === importedName);
  const [first] = entries;
  if (first === undefined) return null;
  return {
    importedName,
    kind: "unregistered",
    node: input.origin.expression,
    specifier: first.importRoutes[0]?.specifier ?? first.declarationPath,
    valueProjections: input.origin.projections,
  };
};
