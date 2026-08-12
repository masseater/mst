import { listedUnder } from "./option-lists.ts";

import type { Options } from "@oxlint/plugins";

export type DeclaredReplacement = {
  readonly name: string;
  readonly substitute: string;
};

export type ReplacementWithdrawal = {
  readonly name: string;
  readonly grounds: string;
};

export const DECLARED_REPLACEMENT_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { name: { type: "string" }, substitute: { type: "string" } },
    required: ["name", "substitute"],
    additionalProperties: false,
  },
} as const;

export const REPLACEMENT_WITHDRAWAL_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { name: { type: "string" }, grounds: { type: "string" } },
    required: ["name"],
    additionalProperties: false,
  },
} as const;

export const DECLARED_OPTION = "declared";

export const WITHDRAWN_OPTION = "withdrawn";

export const DEFAULT_DECLARED_REPLACEMENTS: readonly DeclaredReplacement[] = [];

export const withdrawalsIn = (options: Readonly<Options>): readonly ReplacementWithdrawal[] =>
  listedUnder(options, WITHDRAWN_OPTION).flatMap(({ name, grounds }) =>
    typeof name === "string" && name !== ""
      ? [{ name, grounds: typeof grounds === "string" ? grounds.trim() : "" }]
      : [],
  );

export const declaredReplacementsIn = ({
  options,
  standing,
}: {
  readonly options: Readonly<Options>;
  readonly standing: readonly DeclaredReplacement[];
}): readonly DeclaredReplacement[] => [
  ...standing,
  ...listedUnder(options, DECLARED_OPTION).flatMap(({ name, substitute }) =>
    typeof name === "string" && name !== "" && typeof substitute === "string"
      ? [{ name, substitute }]
      : [],
  ),
];

export const replacementsInForce = ({
  declared,
  withdrawals,
}: {
  readonly declared: readonly DeclaredReplacement[];
  readonly withdrawals: readonly ReplacementWithdrawal[];
}): readonly DeclaredReplacement[] => {
  const lifted = new Set(
    withdrawals.filter((withdrawal) => withdrawal.grounds !== "").map(({ name }) => name),
  );
  return declared.filter((entry) => !lifted.has(entry.name));
};

export const groundlessWithdrawals = (
  withdrawals: readonly ReplacementWithdrawal[],
): readonly ReplacementWithdrawal[] =>
  withdrawals.filter((withdrawal) => withdrawal.grounds === "");

export const deadWithdrawals = ({
  declared,
  withdrawals,
}: {
  readonly declared: readonly DeclaredReplacement[];
  readonly withdrawals: readonly ReplacementWithdrawal[];
}): readonly ReplacementWithdrawal[] => {
  const spoken = new Set(declared.map(({ name }) => name));
  return withdrawals.filter((withdrawal) => !spoken.has(withdrawal.name));
};

export const replacementNamed = ({
  entries,
  name,
}: {
  readonly entries: readonly DeclaredReplacement[];
  readonly name: string;
}): DeclaredReplacement | null => entries.find((entry) => entry.name === name) ?? null;
