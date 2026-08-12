import type { Context, RuleMeta } from "@oxlint/plugins";

const UNCONFIGURED_OWNERSHIP_POLICY =
  "not configured (set the ownershipPolicy option of this rule)";

export const OWNERSHIP_POLICY_SCHEMA: RuleMeta["schema"] = [
  {
    type: "object",
    properties: { ownershipPolicy: { type: "string" } },
    additionalProperties: false,
  },
];

export const ownershipPolicyOf = (ruleOptions: Context["options"]): string => {
  const configured = ruleOptions[0];
  if (typeof configured !== "object" || configured === null || Array.isArray(configured)) {
    return UNCONFIGURED_OWNERSHIP_POLICY;
  }
  const policy = configured.ownershipPolicy;
  if (typeof policy !== "string") return UNCONFIGURED_OWNERSHIP_POLICY;
  return policy.trim() === "" ? UNCONFIGURED_OWNERSHIP_POLICY : policy;
};
