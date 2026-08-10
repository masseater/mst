import { expect, test } from "vite-plus/test";

import { ownershipPolicyOf, UNCONFIGURED_OWNERSHIP_POLICY } from "./ownership-policy.ts";

test("no options at all says the policy is unset instead of naming one", () => {
  expect(ownershipPolicyOf([])).toBe(UNCONFIGURED_OWNERSHIP_POLICY);
});

test("the unset wording tells the reader which option to set", () => {
  expect(UNCONFIGURED_OWNERSHIP_POLICY).toBe(
    "not configured (set the ownershipPolicy option of this rule)",
  );
});

test("a configured policy is passed through as written", () => {
  expect(
    ownershipPolicyOf([{ ownershipPolicy: "Operational vocabularies live in the service." }]),
  ).toBe("Operational vocabularies live in the service.");
});

test("a blank policy is the same as leaving it unset", () => {
  expect(ownershipPolicyOf([{ ownershipPolicy: "   " }])).toBe(UNCONFIGURED_OWNERSHIP_POLICY);
});

test("an option object without the key leaves the policy unset", () => {
  expect(ownershipPolicyOf([{ maxLines: 10 }])).toBe(UNCONFIGURED_OWNERSHIP_POLICY);
});

test("a policy that is not a string leaves it unset", () => {
  expect(ownershipPolicyOf([{ ownershipPolicy: 3 }])).toBe(UNCONFIGURED_OWNERSHIP_POLICY);
});

test("options that are not an object leave the policy unset", () => {
  expect(ownershipPolicyOf(["Operational vocabularies live in the service."])).toBe(
    UNCONFIGURED_OWNERSHIP_POLICY,
  );
  expect(ownershipPolicyOf([["Operational vocabularies live in the service."]])).toBe(
    UNCONFIGURED_OWNERSHIP_POLICY,
  );
  expect(ownershipPolicyOf([null])).toBe(UNCONFIGURED_OWNERSHIP_POLICY);
});
