import { describe, expect, test } from "vite-plus/test";

import { relayConfigFromEnv } from "./relay-config.ts";

const requiredEnv = {
  GITHUB_REPOSITORY: "example-org/example-repo",
  GITHUB_WEBHOOK_SECRET: "shared-secret",
};

describe("relayConfigFromEnv", () => {
  describe("必須の環境変数だけを与える", () => {
    const it = test.extend("configFromRequiredEnvOnly", () => relayConfigFromEnv(requiredEnv));

    it("残りは既定値で解決される", ({ configFromRequiredEnvOnly }) => {
      expect(configFromRequiredEnvOnly).toStrictEqual({
        port: 8080,
        githubRepository: "example-org/example-repo",
        webhookSecret: "shared-secret",
        schedulerServiceAccountEmails: [],
        githubApiOrigin: "https://api.github.com",
      });
    });
  });

  describe("対象リポジトリを与えない", () => {
    const it = test.extend("rejectionForMissingRepository", () => {
      try {
        relayConfigFromEnv({ GITHUB_WEBHOOK_SECRET: "shared-secret" });
        throw new Error("対象リポジトリの無い環境が受理された");
      } catch (rejection) {
        return rejection instanceof Error ? rejection.message : String(rejection);
      }
    });

    it("既定値に落とさず起動を拒否する", ({ rejectionForMissingRepository }) => {
      expect(rejectionForMissingRepository).toBe(`[
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "githubRepository"
    ],
    "message": "Invalid input: expected string, received undefined"
  }
]`);
    });
  });

  describe("webhook シークレットを与えない", () => {
    const it = test.extend("rejectionForMissingWebhookSecret", () => {
      try {
        relayConfigFromEnv({ GITHUB_REPOSITORY: "example-org/example-repo" });
        throw new Error("webhook シークレットの無い環境が受理された");
      } catch (rejection) {
        return rejection instanceof Error ? rejection.message : String(rejection);
      }
    });

    it("起動を拒否する", ({ rejectionForMissingWebhookSecret }) => {
      expect(rejectionForMissingWebhookSecret).toBe(`[
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [
      "webhookSecret"
    ],
    "message": "Invalid input: expected string, received undefined"
  }
]`);
    });
  });

  describe("範囲外の PORT を与える", () => {
    const it = test.extend("rejectionForOutOfRangePort", () => {
      try {
        relayConfigFromEnv({ ...requiredEnv, PORT: "70000" });
        throw new Error("範囲外の PORT が受理された");
      } catch (rejection) {
        return rejection instanceof Error ? rejection.message : String(rejection);
      }
    });

    it("数値化した上で上限超過として拒否する", ({ rejectionForOutOfRangePort }) => {
      expect(rejectionForOutOfRangePort).toBe(`[
  {
    "origin": "number",
    "code": "too_big",
    "maximum": 65535,
    "inclusive": true,
    "path": [
      "port"
    ],
    "message": "Too big: expected number to be <=65535"
  }
]`);
    });
  });

  describe("PORT を数字文字列で与える", () => {
    const it = test.extend("configWithNumericPortString", () =>
      relayConfigFromEnv({ ...requiredEnv, PORT: "3000" }));

    it("数値の port として現れる", ({ configWithNumericPortString }) => {
      expect(configWithNumericPortString).toStrictEqual({
        port: 3000,
        githubRepository: "example-org/example-repo",
        webhookSecret: "shared-secret",
        schedulerServiceAccountEmails: [],
        githubApiOrigin: "https://api.github.com",
      });
    });
  });

  describe("スケジューラ email を publicOrigin と併せて与える", () => {
    const it = test.extend("configWithSchedulerEmails", () =>
      relayConfigFromEnv({
        ...requiredEnv,
        SCHEDULER_SERVICE_ACCOUNT_EMAILS: " first@example.test , ,second@example.test",
        RELAY_PUBLIC_ORIGIN: "https://relay.example.test",
      }));

    it("カンマ区切りが trim され空要素が除去される", ({ configWithSchedulerEmails }) => {
      expect(configWithSchedulerEmails).toStrictEqual({
        port: 8080,
        githubRepository: "example-org/example-repo",
        webhookSecret: "shared-secret",
        schedulerServiceAccountEmails: ["first@example.test", "second@example.test"],
        publicOrigin: "https://relay.example.test",
        githubApiOrigin: "https://api.github.com",
      });
    });
  });

  describe("スケジューラ email を publicOrigin 無しで与える", () => {
    const it = test.extend("rejectionForSchedulerEmailsWithoutPublicOrigin", () => {
      try {
        relayConfigFromEnv({
          ...requiredEnv,
          SCHEDULER_SERVICE_ACCOUNT_EMAILS: "first@example.test",
        });
        throw new Error("publicOrigin の無いスケジューラ設定が受理された");
      } catch (rejection) {
        return rejection instanceof Error ? rejection.message : String(rejection);
      }
    });

    it("起動を拒否する", ({ rejectionForSchedulerEmailsWithoutPublicOrigin }) => {
      expect(rejectionForSchedulerEmailsWithoutPublicOrigin).toBe(`[
  {
    "code": "custom",
    "path": [],
    "message": "publicOrigin is required when schedulerServiceAccountEmails is set"
  }
]`);
    });
  });

  describe("GitHub API の接続先を与える", () => {
    const it = test.extend("configWithOverriddenGithubApiOrigin", () =>
      relayConfigFromEnv({ ...requiredEnv, GITHUB_API_ORIGIN: "http://localhost:9040" }));

    it("既定の接続先を上書きする", ({ configWithOverriddenGithubApiOrigin }) => {
      expect(configWithOverriddenGithubApiOrigin).toStrictEqual({
        port: 8080,
        githubRepository: "example-org/example-repo",
        webhookSecret: "shared-secret",
        schedulerServiceAccountEmails: [],
        githubApiOrigin: "http://localhost:9040",
      });
    });
  });

  describe("CI 抑止ラベルを与える", () => {
    const it = test.extend("configWithCiSuppressionLabel", () =>
      relayConfigFromEnv({ ...requiredEnv, CI_SUPPRESSION_LABEL: "needs-human" }));

    it("任意設定として現れる", ({ configWithCiSuppressionLabel }) => {
      expect(configWithCiSuppressionLabel).toStrictEqual({
        port: 8080,
        githubRepository: "example-org/example-repo",
        webhookSecret: "shared-secret",
        schedulerServiceAccountEmails: [],
        githubApiOrigin: "https://api.github.com",
        ciSuppressionLabel: "needs-human",
      });
    });
  });
});
