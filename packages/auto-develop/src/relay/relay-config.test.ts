import { describe, expect, test } from "vite-plus/test";

import { relayConfigFromEnv } from "./relay-config.ts";

const requiredEnv = {
  GITHUB_REPOSITORY: "example-org/example-repo",
  GITHUB_WEBHOOK_SECRET: "shared-secret",
};

const it = test
  .extend("configFromRequiredEnvOnly", () => relayConfigFromEnv(requiredEnv))
  .extend("rejectionForMissingRepository", (): Error | undefined => {
    try {
      relayConfigFromEnv({ GITHUB_WEBHOOK_SECRET: "shared-secret" });
      return undefined;
    } catch (thrown) {
      return thrown instanceof Error ? thrown : undefined;
    }
  })
  .extend("rejectionForMissingWebhookSecret", (): Error | undefined => {
    try {
      relayConfigFromEnv({ GITHUB_REPOSITORY: "example-org/example-repo" });
      return undefined;
    } catch (thrown) {
      return thrown instanceof Error ? thrown : undefined;
    }
  })
  .extend("rejectionForOutOfRangePort", (): Error | undefined => {
    try {
      relayConfigFromEnv({ ...requiredEnv, PORT: "70000" });
      return undefined;
    } catch (thrown) {
      return thrown instanceof Error ? thrown : undefined;
    }
  })
  .extend("configWithNumericPortString", () => relayConfigFromEnv({ ...requiredEnv, PORT: "3000" }))
  .extend("configWithSchedulerEmails", () =>
    relayConfigFromEnv({
      ...requiredEnv,
      SCHEDULER_SERVICE_ACCOUNT_EMAILS: " first@example.test , ,second@example.test",
      RELAY_PUBLIC_ORIGIN: "https://relay.example.test",
    }),
  )
  .extend("rejectionForSchedulerEmailsWithoutPublicOrigin", (): Error | undefined => {
    try {
      relayConfigFromEnv({
        ...requiredEnv,
        SCHEDULER_SERVICE_ACCOUNT_EMAILS: "first@example.test",
      });
      return undefined;
    } catch (thrown) {
      return thrown instanceof Error ? thrown : undefined;
    }
  })
  .extend("configWithOverriddenGithubApiOrigin", () =>
    relayConfigFromEnv({ ...requiredEnv, GITHUB_API_ORIGIN: "http://localhost:9040" }),
  )
  .extend("configWithCiSuppressionLabel", () =>
    relayConfigFromEnv({ ...requiredEnv, CI_SUPPRESSION_LABEL: "needs-human" }),
  );

describe("relayConfigFromEnv", () => {
  it("必須だけ与えると既定値で解決される", ({ configFromRequiredEnvOnly }) => {
    expect(configFromRequiredEnvOnly).toStrictEqual({
      port: 8080,
      githubRepository: "example-org/example-repo",
      webhookSecret: "shared-secret",
      schedulerServiceAccountEmails: [],
      githubApiOrigin: "https://api.github.com",
    });
  });

  it("対象リポジトリ未設定はデフォルトに落とさず起動を拒否する", ({
    rejectionForMissingRepository,
  }) => {
    expect(rejectionForMissingRepository?.message).toContain("invalid_type");
  });

  it("webhook シークレット未設定は起動を拒否する", ({ rejectionForMissingWebhookSecret }) => {
    expect(rejectionForMissingWebhookSecret?.message).toContain("invalid_type");
  });

  it("PORT は数値化され範囲外は拒否される", ({ rejectionForOutOfRangePort }) => {
    expect(rejectionForOutOfRangePort?.message).toContain("too_big");
  });

  it("PORT の数字文字列は数値になる", ({ configWithNumericPortString }) => {
    expect(configWithNumericPortString.port).toStrictEqual(3000);
  });

  it("スケジューラ email はカンマ区切りで trim され空要素は除去される", ({
    configWithSchedulerEmails,
  }) => {
    expect(configWithSchedulerEmails.schedulerServiceAccountEmails).toStrictEqual([
      "first@example.test",
      "second@example.test",
    ]);
  });

  it("スケジューラ email があるのに publicOrigin が無ければ拒否される", ({
    rejectionForSchedulerEmailsWithoutPublicOrigin,
  }) => {
    expect(rejectionForSchedulerEmailsWithoutPublicOrigin?.message).toContain(
      "publicOrigin is required when schedulerServiceAccountEmails is set",
    );
  });

  it("GitHub API の接続先は設定から上書きできる", ({ configWithOverriddenGithubApiOrigin }) => {
    expect(configWithOverriddenGithubApiOrigin.githubApiOrigin).toStrictEqual(
      "http://localhost:9040",
    );
  });

  it("CI 抑止ラベルは任意設定として現れる", ({ configWithCiSuppressionLabel }) => {
    expect(configWithCiSuppressionLabel.ciSuppressionLabel).toStrictEqual("needs-human");
  });
});
