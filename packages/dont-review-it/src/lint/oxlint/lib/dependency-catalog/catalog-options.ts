import type { Context, RuleMeta } from "@oxlint/plugins";

export const CATALOG_ENTRY_SCHEMA: RuleMeta["schema"] = [
  {
    type: "object",
    properties: {
      catalog: { type: "array", items: { type: "string" } },
      deviations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            workspace: { type: "string" },
            packages: { type: "array", items: { type: "string" } },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
];

type CatalogEntryOptions = {
  readonly catalog?: readonly string[];
  readonly deviations?: readonly {
    readonly workspace: string;
    readonly packages: readonly string[];
  }[];
};

const optionsOf = (options: Context["options"]): CatalogEntryOptions =>
  (options[0] ?? {}) as CatalogEntryOptions;

export const catalogFrom = (options: Context["options"]): ReadonlySet<string> =>
  new Set(optionsOf(options).catalog);

export const deviationsFrom = (
  options: Context["options"],
): ReadonlyMap<string, ReadonlySet<string>> =>
  new Map(
    (optionsOf(options).deviations ?? []).map((deviation) => [
      deviation.workspace,
      new Set(deviation.packages),
    ]),
  );
