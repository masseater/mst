import { isNamedFields } from "../named-fields.ts";

import type { Context, RuleMeta } from "@oxlint/plugins";
import type { RuleMessage } from "../rule-message.ts";

export type DeclaredCheck = {
  readonly name: string;
  readonly coveredPaths: readonly string[];
  readonly excludedPaths: readonly string[];
};

export type RegistrationRow = {
  readonly pattern: string;
  readonly reason: string;
  readonly receivers: readonly string[];
};

export type RegistrationTable = {
  readonly name: string;
  readonly consumedBy: string;
  readonly rows: readonly RegistrationRow[];
  readonly allowances: readonly RegistrationRow[];
};

export type ScopeRegistration = {
  readonly name: string;
  readonly registeredPaths: readonly string[];
};

export type CoverageDeclarations = {
  readonly checks: readonly DeclaredCheck[];
  readonly tables: readonly RegistrationTable[];
  readonly uncheckedDeclarations: readonly RegistrationRow[];
  readonly scopes: readonly ScopeRegistration[];
};

export type CoverageFinding = RuleMessage & { readonly heldPath: string | null };

const REGISTRATION_ROW_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      pattern: { type: "string" },
      reason: { type: "string" },
      receivers: { type: "array", items: { type: "string" } },
    },
    required: ["pattern", "reason"],
    additionalProperties: false,
  },
};

export const DECLARED_COVERAGE_SCHEMA: RuleMeta["schema"] = [
  {
    type: "object",
    properties: {
      declaredChecks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            coveredPaths: { type: "array", items: { type: "string" } },
            excludedPaths: { type: "array", items: { type: "string" } },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      registries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            consumedBy: { type: "string" },
            rows: REGISTRATION_ROW_SCHEMA,
            allowances: REGISTRATION_ROW_SCHEMA,
          },
          required: ["name", "consumedBy"],
          additionalProperties: false,
        },
      },
      uncheckedDeclarations: REGISTRATION_ROW_SCHEMA,
      scopeRegistrations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            registeredPaths: { type: "array", items: { type: "string" } },
          },
          required: ["name", "registeredPaths"],
          additionalProperties: false,
        },
      },
      unscannedDirectories: { type: "array", items: { type: "string" } },
    },
    additionalProperties: false,
  },
];

const fieldsOf = (held: unknown): Readonly<Record<string, unknown>> =>
  isNamedFields(held) ? held : {};

const writtenTextOf = (held: unknown): string | null => {
  if (typeof held !== "string") return null;
  return held.trim() === "" ? null : held;
};

const writtenTextsOf = (held: unknown): readonly string[] =>
  (Array.isArray(held) ? held : []).flatMap((entry: unknown) => {
    const written = writtenTextOf(entry);
    return written === null ? [] : [written];
  });

const readEach = <Read>(
  held: unknown,
  readOne: (declared: Readonly<Record<string, unknown>>) => Read | null,
): readonly Read[] =>
  (Array.isArray(held) ? held : [])
    .map((entry: unknown) => readOne(fieldsOf(entry)))
    .filter((entry) => entry !== null);

const rowOf = (declared: Readonly<Record<string, unknown>>): RegistrationRow | null => {
  const pattern = writtenTextOf(declared.pattern);
  const reason = writtenTextOf(declared.reason);
  if (pattern === null || reason === null) return null;
  return { pattern, reason, receivers: writtenTextsOf(declared.receivers) };
};

const checkOf = (declared: Readonly<Record<string, unknown>>): DeclaredCheck | null => {
  const name = writtenTextOf(declared.name);
  if (name === null) return null;
  return {
    name,
    coveredPaths: writtenTextsOf(declared.coveredPaths),
    excludedPaths: writtenTextsOf(declared.excludedPaths),
  };
};

const tableOf = (declared: Readonly<Record<string, unknown>>): RegistrationTable | null => {
  const name = writtenTextOf(declared.name);
  const consumedBy = writtenTextOf(declared.consumedBy);
  if (name === null || consumedBy === null) return null;
  return {
    name,
    consumedBy,
    rows: readEach(declared.rows, rowOf),
    allowances: readEach(declared.allowances, rowOf),
  };
};

const scopeOf = (declared: Readonly<Record<string, unknown>>): ScopeRegistration | null => {
  const name = writtenTextOf(declared.name);
  if (name === null) return null;
  return { name, registeredPaths: writtenTextsOf(declared.registeredPaths) };
};

export const coverageDeclarationsFrom = (options: Context["options"]): CoverageDeclarations => {
  const declared = fieldsOf(options[0]);
  return {
    checks: readEach(declared.declaredChecks, checkOf),
    tables: readEach(declared.registries, tableOf),
    uncheckedDeclarations: readEach(declared.uncheckedDeclarations, rowOf),
    scopes: readEach(declared.scopeRegistrations, scopeOf),
  };
};

export const spelledNames = (spellings: readonly string[]): string =>
  spellings.map((spelling) => `\`${spelling}\``).join(", ");
