import { describe, expect, test } from "vite-plus/test";

import { isEnvironmentFailure } from "./path-failure.ts";

class RuntimeRefusal extends Error {
  constructor(readonly code: string | number) {
    super("the runtime refused");
  }
}

describe("isEnvironmentFailure", () => {
  test("a failure carrying a code came from the environment", () => {
    expect(isEnvironmentFailure(new RuntimeRefusal("EROFS"))).toBe(true);
  });

  test("a failure carrying no code came from our own declarations", () => {
    expect(isEnvironmentFailure(new TypeError("cannot serialise a function"))).toBe(false);
  });

  test("a thrown value that is not an object carries nothing to classify", () => {
    expect(isEnvironmentFailure("EROFS")).toBe(false);
  });
});
