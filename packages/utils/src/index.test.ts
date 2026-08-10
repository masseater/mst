import { describe, expect, test } from "vite-plus/test";

import { fn } from "./index.ts";

describe("index", () => {
  test("fn", () => {
    expect(fn()).toBe("Hello, tsdown!");
  });
});
