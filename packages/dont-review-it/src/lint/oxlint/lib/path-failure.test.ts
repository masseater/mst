import { describe, expect, test } from "vite-plus/test";

import { isEnvironmentFailure } from "./path-failure.ts";

class RuntimeRefusal extends Error {
  constructor(readonly code: string | number) {
    super("the runtime refused");
  }
}

describe("isEnvironmentFailure", () => {
  describe("a failure carrying a code", () => {
    const it = test.extend("cameFromTheEnvironment", () =>
      isEnvironmentFailure(new RuntimeRefusal("EROFS")));

    it("came from the environment", ({ cameFromTheEnvironment }) => {
      expect(cameFromTheEnvironment).toBe(true);
    });
  });

  describe("a failure carrying no code", () => {
    const it = test.extend("cameFromTheEnvironment", () =>
      isEnvironmentFailure(new TypeError("cannot serialise a function")));

    it("came from our own declarations", ({ cameFromTheEnvironment }) => {
      expect(cameFromTheEnvironment).toBe(false);
    });
  });

  describe("a thrown value that is not an object", () => {
    const it = test.extend("cameFromTheEnvironment", () => isEnvironmentFailure("EROFS"));

    it("carries nothing to classify", ({ cameFromTheEnvironment }) => {
      expect(cameFromTheEnvironment).toBe(false);
    });
  });
});
