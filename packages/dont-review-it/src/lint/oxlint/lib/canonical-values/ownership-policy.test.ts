import { describe, expect, test } from "vite-plus/test";

import { ownershipPolicyOf } from "./ownership-policy.ts";

const UNCONFIGURED = "not configured (set the ownershipPolicy option of this rule)";

describe("ownershipPolicyOf", () => {
  describe("no options at all", () => {
    const it = test.extend("policy", () => ownershipPolicyOf([]));

    it("says the policy is unset and names the option to set", ({ policy }) => {
      expect(policy).toBe(UNCONFIGURED);
    });
  });

  describe("a written policy", () => {
    const it = test.extend("policy", () =>
      ownershipPolicyOf([{ ownershipPolicy: "Operational vocabularies live in the service." }]));

    it("is passed through as written", ({ policy }) => {
      expect(policy).toBe("Operational vocabularies live in the service.");
    });
  });

  describe("a blank policy", () => {
    const it = test.extend("policy", () => ownershipPolicyOf([{ ownershipPolicy: "   " }]));

    it("is the same as leaving it unset", ({ policy }) => {
      expect(policy).toBe(UNCONFIGURED);
    });
  });

  describe("an option object without the key", () => {
    const it = test.extend("policy", () => ownershipPolicyOf([{ maxLines: 10 }]));

    it("leaves the policy unset", ({ policy }) => {
      expect(policy).toBe(UNCONFIGURED);
    });
  });

  describe("a policy that is not a string", () => {
    const it = test.extend("policy", () => ownershipPolicyOf([{ ownershipPolicy: 3 }]));

    it("leaves the policy unset", ({ policy }) => {
      expect(policy).toBe(UNCONFIGURED);
    });
  });

  describe("an option written as a text", () => {
    const it = test.extend("policy", () =>
      ownershipPolicyOf(["Operational vocabularies live in the service."]));

    it("leaves the policy unset", ({ policy }) => {
      expect(policy).toBe(UNCONFIGURED);
    });
  });

  describe("an option written as a list", () => {
    const it = test.extend("policy", () =>
      ownershipPolicyOf([["Operational vocabularies live in the service."]]));

    it("leaves the policy unset", ({ policy }) => {
      expect(policy).toBe(UNCONFIGURED);
    });
  });

  describe("an option written as nothing", () => {
    const it = test.extend("policy", () => ownershipPolicyOf([null]));

    it("leaves the policy unset", ({ policy }) => {
      expect(policy).toBe(UNCONFIGURED);
    });
  });
});
