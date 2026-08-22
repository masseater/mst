import { describe, expect, test } from "vite-plus/test";

import { isWithin } from "./is-within.ts";

describe("isWithin", () => {
  const it = test
    .extend("ancestorWithinItself", () => {
      const ancestor = { parent: null };
      return isWithin(ancestor, ancestor);
    })
    .extend("grandchildWithinAncestor", () => {
      const ancestor = { parent: null };
      const child = { parent: ancestor };
      const grandchild = { parent: child };
      return isWithin(grandchild, ancestor);
    })
    .extend("grandchildWithinSeparateTree", () => {
      const ancestor = { parent: null };
      const child = { parent: ancestor };
      const grandchild = { parent: child };
      const separate = { parent: null };
      return isWithin(grandchild, separate);
    });

  it("accepts the ancestor itself", ({ ancestorWithinItself }) => {
    expect(ancestorWithinItself).toBe(true);
  });

  it("follows parents to an ancestor", ({ grandchildWithinAncestor }) => {
    expect(grandchildWithinAncestor).toBe(true);
  });

  it("rejects a separate tree", ({ grandchildWithinSeparateTree }) => {
    expect(grandchildWithinSeparateTree).toBe(false);
  });
});
