import { describe, expect, test } from "vite-plus/test";

import { relayConfigFromEnv } from "./relay-config.ts";

const requiredEnv = {
  GITHUB_REPOSITORY: "example-org/example-repo",
  GITHUB_WEBHOOK_SECRET: "shared-secret",
};

describe("relayConfigFromEnv", () => {
  test("必須だけ与えると既定値で解決される", () => {
    expect(relayConfigFromEnv(requiredEnv)).toStrictEqual({
      port: 8080,
      githubRepository: "example-org/example-repo",
      webhookSecret: "shared-secret",
      schedulerServiceAccountEmails: [],
      githubApiOrigin: "https://api.github.com",
    });
  });

  test("対象リポジトリ未設定はデフォルトに落とさず起動を拒否する", () => {
    expect(() => relayConfigFromEnv({ GITHUB_WEBHOOK_SECRET: "shared-secret" })).toThrow(
      "invalid_type",
    );
  });

  test("webhook シークレット未設定は起動を拒否する", () => {
    expect(() => relayConfigFromEnv({ GITHUB_REPOSITORY: "example-org/example-repo" })).toThrow(
      "invalid_type",
    );
  });

  test("PORT は数値化され範囲外は拒否される", () => {
    expect(() => relayConfigFromEnv({ ...requiredEnv, PORT: "70000" })).toThrow("too_big");
  });

  test("PORT の数字文字列は数値になる", () => {
    expect(relayConfigFromEnv({ ...requiredEnv, PORT: "3000" }).port).toStrictEqual(3000);
  });

  test("スケジューラ email はカンマ区切りで trim され空要素は除去される", () => {
    const relayConfig = relayConfigFromEnv({
      ...requiredEnv,
      SCHEDULER_SERVICE_ACCOUNT_EMAILS: " first@example.test , ,second@example.test",
      RELAY_PUBLIC_ORIGIN: "https://relay.example.test",
    });
    expect(relayConfig.schedulerServiceAccountEmails).toStrictEqual([
      "first@example.test",
      "second@example.test",
    ]);
  });

  test("スケジューラ email があるのに publicOrigin が無ければ拒否される", () => {
    expect(() =>
      relayConfigFromEnv({
        ...requiredEnv,
        SCHEDULER_SERVICE_ACCOUNT_EMAILS: "first@example.test",
      }),
    ).toThrow("publicOrigin is required when schedulerServiceAccountEmails is set");
  });

  test("GitHub API の接続先は設定から上書きできる", () => {
    const relayConfig = relayConfigFromEnv({
      ...requiredEnv,
      GITHUB_API_ORIGIN: "http://localhost:9040",
    });
    expect(relayConfig.githubApiOrigin).toStrictEqual("http://localhost:9040");
  });

  test("CI 抑止ラベルは任意設定として現れる", () => {
    const relayConfig = relayConfigFromEnv({ ...requiredEnv, CI_SUPPRESSION_LABEL: "needs-human" });
    expect(relayConfig.ciSuppressionLabel).toStrictEqual("needs-human");
  });
});
