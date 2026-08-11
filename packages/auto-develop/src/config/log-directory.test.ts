import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { LOG_DIR_ENV_VAR, resolveLogDirectory } from "./log-directory.ts";

describe("resolveLogDirectory", () => {
  test("上書き変数が非空ならその値をそのまま使う", () => {
    const env = { [LOG_DIR_ENV_VAR]: "/var/log/auto-develop" };
    expect(resolveLogDirectory("/repo", env)).toStrictEqual("/var/log/auto-develop");
  });

  test("空文字列なら repoRoot 直下の logs に既定する", () => {
    const env = { [LOG_DIR_ENV_VAR]: "" };
    expect(resolveLogDirectory("/repo", env)).toStrictEqual(join("/repo", "logs"));
  });

  test("未設定でも repoRoot 直下の logs に既定する", () => {
    expect(resolveLogDirectory("/repo", {})).toStrictEqual(join("/repo", "logs"));
  });
});
