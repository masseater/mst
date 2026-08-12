import { describe, expect, test } from "vite-plus/test";

import { ownershipPolicyOf } from "./ownership-policy.ts";

const UNCONFIGURED = "not configured (set the ownershipPolicy option of this rule)";

const it = test
  .extend("policyOfEmptyOptions", () => ownershipPolicyOf([]))
  .extend("policyOfWrittenPolicy", () =>
    ownershipPolicyOf([{ ownershipPolicy: "Operational vocabularies live in the service." }]),
  )
  .extend("policyOfBlankPolicy", () => ownershipPolicyOf([{ ownershipPolicy: "   " }]))
  .extend("policyOfForeignSettings", () => ownershipPolicyOf([{ maxLines: 10 }]))
  .extend("policyOfNumberedPolicy", () => ownershipPolicyOf([{ ownershipPolicy: 3 }]))
  .extend("policyOfTextOption", () =>
    ownershipPolicyOf(["Operational vocabularies live in the service."]),
  )
  .extend("policyOfListedOption", () =>
    ownershipPolicyOf([["Operational vocabularies live in the service."]]),
  )
  .extend("policyOfMissingOption", () => ownershipPolicyOf([null]));

describe("ownership-policy", () => {
  it("no options at all says the policy is unset and names the option to set", ({
    policyOfEmptyOptions,
  }) => {
    expect(policyOfEmptyOptions).toBe(UNCONFIGURED);
  });

  it("a configured policy is passed through as written", ({ policyOfWrittenPolicy }) => {
    expect(policyOfWrittenPolicy).toBe("Operational vocabularies live in the service.");
  });

  it("a blank policy is the same as leaving it unset", ({ policyOfBlankPolicy }) => {
    expect(policyOfBlankPolicy).toBe(UNCONFIGURED);
  });

  it("an option object without the key leaves the policy unset", ({ policyOfForeignSettings }) => {
    expect(policyOfForeignSettings).toBe(UNCONFIGURED);
  });

  it("a policy that is not a string leaves it unset", ({ policyOfNumberedPolicy }) => {
    expect(policyOfNumberedPolicy).toBe(UNCONFIGURED);
  });

  it("an option written as a text leaves the policy unset", ({ policyOfTextOption }) => {
    expect(policyOfTextOption).toBe(UNCONFIGURED);
  });

  it("an option written as a list leaves the policy unset", ({ policyOfListedOption }) => {
    expect(policyOfListedOption).toBe(UNCONFIGURED);
  });

  it("an option written as nothing leaves the policy unset", ({ policyOfMissingOption }) => {
    expect(policyOfMissingOption).toBe(UNCONFIGURED);
  });
});
