import { describe, expect, it } from "vite-plus/test";

import { EXIT_MISUSE, EXIT_PROBLEMS_FOUND, EXIT_SUCCESS } from "../src/index.ts";

describe("CLI の終了コード", () => {
  it("成功を 0 で表す", () => {
    expect(EXIT_SUCCESS).toBe(0);
  });

  it("問題の発見を 1 で表す", () => {
    expect(EXIT_PROBLEMS_FOUND).toBe(1);
  });

  it("誤った使い方を 2 で表す", () => {
    expect(EXIT_MISUSE).toBe(2);
  });
});
