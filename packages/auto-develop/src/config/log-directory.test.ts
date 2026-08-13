import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { resolveLogDirectory } from "./log-directory.ts";

describe("resolveLogDirectory", () => {
  const it = test
    .extend("overriddenLogDir", () =>
      resolveLogDirectory("/repo", { AUTO_DEVELOP_LOG_DIR: "/var/log/auto-develop" }))
    .extend("logDirForEmptyOverride", () =>
      resolveLogDirectory("/repo", { AUTO_DEVELOP_LOG_DIR: "" }),
    )
    .extend("logDirWithoutOverride", () => resolveLogDirectory("/repo", {}))
    .extend("defaultLogDir", () => join("/repo", "logs"));

  it("上書き変数が非空ならその値をそのまま使う", ({ overriddenLogDir }) => {
    expect(overriddenLogDir).toStrictEqual("/var/log/auto-develop");
  });

  it("空文字列なら repoRoot 直下の logs に既定する", ({
    logDirForEmptyOverride,
    defaultLogDir,
  }) => {
    expect(logDirForEmptyOverride).toStrictEqual(defaultLogDir);
  });

  it("未設定でも repoRoot 直下の logs に既定する", ({ logDirWithoutOverride, defaultLogDir }) => {
    expect(logDirWithoutOverride).toStrictEqual(defaultLogDir);
  });
});
