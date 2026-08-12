import { OWNERSHIP_POLICY_SCHEMA } from "../lib/canonical-values/ownership-policy.ts";

export const CANONICAL_VALUE_RULE_NAME =
  "no-local-finite-value-set--use-or-register-canonical-values";

export const CANONICAL_VALUE_RULE_META = {
  type: "problem",
  docs: {
    description:
      "Disallow defining a finite value set inside a file that does not own it, so one place declares the vocabulary and every other place derives from it",
    relatedGuidelines: [],
  },
  messages: {
    localFiniteValueSetWithOwner:
      "Defining a finite value set inside a file that does not own it is forbidden, because the same vocabulary then lives in two places and nothing fails when they disagree. Delete the local values and derive the schema, the type, and the membership check from the public API of {{owner}}. Ownership policy: {{ownershipPolicy}}.",
    localFiniteValueSetWithOwnerCandidates:
      "Defining a finite value set inside a file that does not own it is forbidden, because the same vocabulary then lives in two places and nothing fails when they disagree. Delete the local values and derive everything from the owner whose concept, reason to change, and boundary match this one, choosing among these candidates yourself rather than by their order: {{owners}}. Ownership policy: {{ownershipPolicy}}.",
    localFiniteValueSetWithoutOwner:
      "Defining a finite value set inside a file that does not own it is forbidden, because the same vocabulary then lives in two places and nothing fails when they disagree. Read the design records and the sources to find the owner of this concept. Read the public types of the packages this one depends on as well, because a dependency that already owns this vocabulary is the owner, and the type is derived from it rather than declared again. Register the runtime values in the place that should own it only once you know nothing owns it yet. Ownership policy: {{ownershipPolicy}}.",
    localFiniteValueSetOwnedByLibraryType:
      "Defining a finite value set that a dependency already owns is forbidden, because the same vocabulary then lives in two places and nothing fails when they disagree. Delete the local values and derive the type from {{owner}}, so the declaration stops compiling when the dependency changes the vocabulary. Ownership policy: {{ownershipPolicy}}.",
    localFiniteValueSetOwnedByLibraryTypeCandidates:
      "Defining a finite value set that a dependency already owns is forbidden, because the same vocabulary then lives in two places and nothing fails when they disagree. Delete the local values and derive the type from the dependency whose concept, reason to change, and boundary match this one, choosing among these candidates yourself rather than by their order: {{owners}}. Ownership policy: {{ownershipPolicy}}.",
    unregisteredCanonicalValuesImportRoute:
      "Feeding a finite value set from a repository import that the catalog does not resolve is forbidden, because the route looks like it goes through an owner while no owner is declared. `{{name}}` from `{{specifier}}` is neither a registered public export path nor an annotated declaration. Register the owner of this concept and import through the route the catalog resolves.",
  },
  schema: OWNERSHIP_POLICY_SCHEMA,
} as const;
