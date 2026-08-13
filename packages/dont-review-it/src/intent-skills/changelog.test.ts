import { describe, expect, test } from "vite-plus/test";

import { declaresVersion } from "./changelog.ts";

describe("declaresVersion", () => {
  test("a heading naming the version is found", () => {
    expect(
      declaresVersion({ source: "# Title\n\n## 0.1.0\n\n- a change\n", version: "0.1.0" }),
    ).toBe(true);
  });

  test("a heading that carries a date after the version still counts", () => {
    expect(declaresVersion({ source: "## 0.1.0 - 2026-08-13\n", version: "0.1.0" })).toBe(true);
  });

  test("a heading for another version does not count", () => {
    expect(declaresVersion({ source: "## 0.0.9\n", version: "0.1.0" })).toBe(false);
  });

  test("a version that only prefixes the heading does not count", () => {
    expect(declaresVersion({ source: "## 0.1.00\n", version: "0.1.0" })).toBe(false);
  });

  test("a heading at another depth does not count", () => {
    expect(declaresVersion({ source: "### 0.1.0\n", version: "0.1.0" })).toBe(false);
  });

  test("the version written outside a heading does not count", () => {
    expect(declaresVersion({ source: "released 0.1.0 today\n", version: "0.1.0" })).toBe(false);
  });
});
