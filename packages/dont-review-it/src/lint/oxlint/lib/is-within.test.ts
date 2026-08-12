import { describe, expect, test } from "vite-plus/test";

import { isWithin } from "./is-within.ts";

describe("isWithin", () => {
  test("it follows parents through the ancestor itself and rejects a separate tree", () => {
    const ancestor = { parent: null };
    const child = { parent: ancestor };
    const grandchild = { parent: child };
    const separate = { parent: null };

    expect(isWithin(ancestor, ancestor)).toBe(true);
    expect(isWithin(grandchild, ancestor)).toBe(true);
    expect(isWithin(grandchild, separate)).toBe(false);
  });
});
