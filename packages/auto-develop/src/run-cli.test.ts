import { EXIT_MISUSE } from "@mst/utils";
import { describe, expect, test } from "vite-plus/test";

import { runAutoDevelop } from "./run-cli.ts";

describe("runAutoDevelop", () => {
  test("コマンドが無いので使い方を stderr へ返す", () => {
    expect(runAutoDevelop()).toStrictEqual({
      exitCode: EXIT_MISUSE,
      out: "",
      error: "Usage: auto-develop <command>\n",
    });
  });
});
