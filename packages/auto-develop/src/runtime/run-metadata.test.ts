import { describe, expect, test } from "vite-plus/test";

import { buildRunMetadata, runMetadataLogFields } from "./run-metadata.ts";

describe("buildRunMetadata", () => {
  describe("claude を上書き無しで起動する", () => {
    const it = test.extend("claudeMetadata", () =>
      buildRunMetadata({
        mode: "reviewer",
        engine: "claude",
        ghUser: "review-bot",
        ghUserSource: "auto",
        ghTokenSource: "github-cli",
        concurrency: 3,
        dryRun: false,
        dangerouslySkipPermissions: false,
        targetPrs: [7],
        excludedPrs: [9],
      }));

    it("起動コマンドはエンジン名そのものになる", ({ claudeMetadata }) => {
      expect(claudeMetadata).toStrictEqual({
        mode: "reviewer",
        engine: "claude",
        engineCommand: "claude",
        engineOverrideSource: "default",
        ghUser: "review-bot",
        ghUserSource: "auto",
        ghTokenSource: "github-cli",
        concurrency: 3,
        dryRun: false,
        dangerouslySkipPermissions: false,
        targetPrs: [7],
        excludedPrs: [9],
      });
    });
  });

  describe("codex を上書き無しで起動する", () => {
    const it = test.extend("codexMetadata", () =>
      buildRunMetadata({
        mode: "author",
        engine: "codex",
        ghUser: "author-bot",
        ghUserSource: "override",
        ghTokenSource: "environment-variable",
        concurrency: 1,
        dryRun: true,
        dangerouslySkipPermissions: false,
        targetPrs: [12],
        excludedPrs: [],
      }));

    it("エンジンの由来は default になる", ({ codexMetadata }) => {
      expect(codexMetadata).toStrictEqual({
        mode: "author",
        engine: "codex",
        engineCommand: "codex",
        engineOverrideSource: "default",
        ghUser: "author-bot",
        ghUserSource: "override",
        ghTokenSource: "environment-variable",
        concurrency: 1,
        dryRun: true,
        dangerouslySkipPermissions: false,
        targetPrs: [12],
        excludedPrs: [],
      });
    });
  });

  describe("claude をラッパーコマンドで上書きして起動する", () => {
    const it = test.extend("wrappedClaudeMetadata", () =>
      buildRunMetadata({
        mode: "reviewer",
        engine: "claude",
        engineOverride: "wrapper claude",
        ghUser: "review-bot",
        ghUserSource: "auto",
        ghTokenSource: "github-cli",
        concurrency: 3,
        dryRun: false,
        dangerouslySkipPermissions: false,
        targetPrs: [7],
        excludedPrs: [9],
      }));

    it("起動コマンドは上書きした文字列になる", ({ wrappedClaudeMetadata }) => {
      expect(wrappedClaudeMetadata).toStrictEqual({
        mode: "reviewer",
        engine: "claude",
        engineCommand: "wrapper claude",
        engineOverrideSource: "override",
        ghUser: "review-bot",
        ghUserSource: "auto",
        ghTokenSource: "github-cli",
        concurrency: 3,
        dryRun: false,
        dangerouslySkipPermissions: false,
        targetPrs: [7],
        excludedPrs: [9],
      });
    });
  });

  describe("codex を絶対パスで上書きして起動する", () => {
    const it = test.extend("pinnedCodexMetadata", () =>
      buildRunMetadata({
        mode: "author",
        engine: "codex",
        engineOverride: "/usr/local/bin/codex",
        ghUser: "author-bot",
        ghUserSource: "override",
        ghTokenSource: "environment-variable",
        concurrency: 2,
        dryRun: false,
        dangerouslySkipPermissions: true,
        targetPrs: [],
        excludedPrs: [3],
      }));

    it("エンジンの由来は override になる", ({ pinnedCodexMetadata }) => {
      expect(pinnedCodexMetadata).toStrictEqual({
        mode: "author",
        engine: "codex",
        engineCommand: "/usr/local/bin/codex",
        engineOverrideSource: "override",
        ghUser: "author-bot",
        ghUserSource: "override",
        ghTokenSource: "environment-variable",
        concurrency: 2,
        dryRun: false,
        dangerouslySkipPermissions: true,
        targetPrs: [],
        excludedPrs: [3],
      });
    });
  });

  describe("複数の PR 番号を対象と除外に渡す", () => {
    const it = test.extend("multiPrMetadata", () =>
      buildRunMetadata({
        mode: "reviewer",
        engine: "claude",
        ghUser: "review-bot",
        ghUserSource: "auto",
        ghTokenSource: "github-cli",
        concurrency: 4,
        dryRun: false,
        dangerouslySkipPermissions: false,
        targetPrs: [7, 11, 13],
        excludedPrs: [9, 15],
      }));

    it("渡した並びのまま PR 番号のリストが載る", ({ multiPrMetadata }) => {
      expect(multiPrMetadata).toStrictEqual({
        mode: "reviewer",
        engine: "claude",
        engineCommand: "claude",
        engineOverrideSource: "default",
        ghUser: "review-bot",
        ghUserSource: "auto",
        ghTokenSource: "github-cli",
        concurrency: 4,
        dryRun: false,
        dangerouslySkipPermissions: false,
        targetPrs: [7, 11, 13],
        excludedPrs: [9, 15],
      });
    });
  });
});

describe("runMetadataLogFields", () => {
  describe("GitHub ログインを持つ metadata を渡す", () => {
    const it = test.extend("loggedFieldsOfNamedUser", () =>
      runMetadataLogFields(
        buildRunMetadata({
          mode: "reviewer",
          engine: "claude",
          ghUser: "review-bot",
          ghUserSource: "auto",
          ghTokenSource: "github-cli",
          concurrency: 3,
          dryRun: false,
          dangerouslySkipPermissions: false,
          targetPrs: [7],
          excludedPrs: [9],
        }),
      ));

    it("ログ用フィールドに GitHub ログインを含めない", ({ loggedFieldsOfNamedUser }) => {
      expect(loggedFieldsOfNamedUser).toStrictEqual({
        mode: "reviewer",
        engine: "claude",
        engineCommand: "claude",
        engineOverrideSource: "default",
        ghUserSource: "auto",
        ghTokenSource: "github-cli",
        concurrency: 3,
        dryRun: false,
        dangerouslySkipPermissions: false,
        targetPrs: [7],
        excludedPrs: [9],
      });
    });
  });

  describe("identity を自動判定した metadata を渡す", () => {
    const it = test.extend("loggedFieldsOfAutoIdentity", () =>
      runMetadataLogFields(
        buildRunMetadata({
          mode: "author",
          engine: "codex",
          ghUser: "author-bot",
          ghUserSource: "auto",
          ghTokenSource: "environment-variable",
          concurrency: 1,
          dryRun: true,
          dangerouslySkipPermissions: false,
          targetPrs: [12],
          excludedPrs: [],
        }),
      ));

    it("ログ用フィールドに identity の由来は含める", ({ loggedFieldsOfAutoIdentity }) => {
      expect(loggedFieldsOfAutoIdentity).toStrictEqual({
        mode: "author",
        engine: "codex",
        engineCommand: "codex",
        engineOverrideSource: "default",
        ghUserSource: "auto",
        ghTokenSource: "environment-variable",
        concurrency: 1,
        dryRun: true,
        dangerouslySkipPermissions: false,
        targetPrs: [12],
        excludedPrs: [],
      });
    });
  });

  describe("token を GitHub CLI から取得した metadata を渡す", () => {
    const it = test.extend("loggedFieldsOfGithubCliToken", () =>
      runMetadataLogFields(
        buildRunMetadata({
          mode: "reviewer",
          engine: "claude",
          engineOverride: "wrapper claude",
          ghUser: "review-bot",
          ghUserSource: "override",
          ghTokenSource: "github-cli",
          concurrency: 2,
          dryRun: false,
          dangerouslySkipPermissions: true,
          targetPrs: [7, 11],
          excludedPrs: [9],
        }),
      ));

    it("ログ用フィールドに token の取得経路は含める", ({ loggedFieldsOfGithubCliToken }) => {
      expect(loggedFieldsOfGithubCliToken).toStrictEqual({
        mode: "reviewer",
        engine: "claude",
        engineCommand: "wrapper claude",
        engineOverrideSource: "override",
        ghUserSource: "override",
        ghTokenSource: "github-cli",
        concurrency: 2,
        dryRun: false,
        dangerouslySkipPermissions: true,
        targetPrs: [7, 11],
        excludedPrs: [9],
      });
    });
  });
});
