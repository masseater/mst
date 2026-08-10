import { describe, expect, it } from "vite-plus/test";

import { createCliRunner, EXIT_MISUSE, EXIT_SUCCESS } from "./cli-result.ts";

describe("createCliRunner", () => {
  it("forwards arguments and returns a completed CLI run", async () => {
    const run = createCliRunner((subject: string) =>
      Promise.resolve({
        exitCode: EXIT_SUCCESS,
        out: `${subject}\n`,
        error: "",
      }),
    );

    await expect(run("checked subject")).resolves.toStrictEqual({
      exitCode: EXIT_SUCCESS,
      out: "checked subject\n",
      error: "",
    });
  });

  it("surfaces a rejected operation as CLI misuse", async () => {
    const run = createCliRunner(() => Promise.reject(new Error("comparison failed")));

    await expect(run()).resolves.toStrictEqual({
      exitCode: EXIT_MISUSE,
      out: "",
      error: "comparison failed\n",
    });
  });
});
