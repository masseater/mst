import { expect, test } from "vite-plus/test";

import { ownershipPolicyOf } from "./ownership-policy.ts";

const UNCONFIGURED = "not configured (set the ownershipPolicy option of this rule)";

test("no options at all says the policy is unset and names the option to set", () => {
  expect(ownershipPolicyOf([])).toBe(UNCONFIGURED);
});

test("a configured policy is passed through as written", () => {
  expect(
    ownershipPolicyOf([{ ownershipPolicy: "Operational vocabularies live in the service." }]),
  ).toBe("Operational vocabularies live in the service.");
});

test("a blank policy is the same as leaving it unset", () => {
  expect(ownershipPolicyOf([{ ownershipPolicy: "   " }])).toBe(UNCONFIGURED);
});

test("an option object without the key leaves the policy unset", () => {
  expect(ownershipPolicyOf([{ maxLines: 10 }])).toBe(UNCONFIGURED);
});

test("a policy that is not a string leaves it unset", () => {
  expect(ownershipPolicyOf([{ ownershipPolicy: 3 }])).toBe(UNCONFIGURED);
});

test("options that are not an object leave the policy unset", () => {
  expect(ownershipPolicyOf(["Operational vocabularies live in the service."])).toBe(UNCONFIGURED);
  expect(ownershipPolicyOf([["Operational vocabularies live in the service."]])).toBe(UNCONFIGURED);
  expect(ownershipPolicyOf([null])).toBe(UNCONFIGURED);
});
