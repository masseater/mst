import { EXIT_MISUSE } from "@mst/repository-checks";
import { describe, expect, it } from "vite-plus/test";

import { runDontReviewIt } from "../src/run-cli.ts";

describe("リポジトリ検査の入口", () => {
  it("check 以外の命令に使い方を返して失敗する", () => {
    const finished = runDontReviewIt(["deploy"]);
    expect(finished.exitCode).toBe(EXIT_MISUSE);
    expect(finished.error).toContain("Usage:");
  });

  it("存在しない場所を検査対象に取らない", () => {
    const finished = runDontReviewIt([
      "check",
      "--repository-root",
      "/nonexistent/verified-specifications-probe",
    ]);
    expect(finished.exitCode).toBe(EXIT_MISUSE);
    expect(finished.error).toContain("is not a directory");
  });
});
