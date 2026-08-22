import { standardIoTest } from "@mst/dont-review-it/vitest";
import { EXIT_MISUSE } from "@mst/repository-checks";
import { runCommand } from "citty";
import { describe, expect, test, vi } from "vite-plus/test";

import { createAutoDevelopCommand } from "./runtime-command.ts";

describe("createAutoDevelopCommand", () => {
  describe("有効な実行引数", () => {
    const it = test
      .extend("reviewerRunMode", async () => {
        const runMode = vi.fn<Parameters<typeof createAutoDevelopCommand>[0]["runMode"]>(() =>
          Promise.resolve(),
        );
        const environment: Readonly<Record<string, string>> = {
          AUTO_DEVELOP_RELAY_ORIGIN: "https://relay.example.test",
          GITHUB_REPOSITORY: "owner/repository",
          GH_TOKEN: "primary-token",
        };
        const command = createAutoDevelopCommand({
          readEnvironment: (environmentVariable) => environment[environmentVariable],
          runMode,
        });
        await runCommand(command, {
          rawArgs: [
            "reviewer",
            "--concurrency",
            "5",
            "--dry-run",
            "--pr",
            "7, invalid, 0, 8.5, 9",
            "--exclude-pr",
            "4",
            "--gh-user",
            "review-bot",
            "--dangerously-skip-permissions",
          ],
        });
        return runMode;
      })
      .extend("authorRunMode", async () => {
        const runMode = vi.fn<Parameters<typeof createAutoDevelopCommand>[0]["runMode"]>(() =>
          Promise.resolve(),
        );
        const environment: Readonly<Record<string, string>> = {
          AUTO_DEVELOP_RELAY_ORIGIN: "https://relay.example.test",
          GITHUB_REPOSITORY: "owner/repository",
          GITHUB_TOKEN: "fallback-token",
        };
        const command = createAutoDevelopCommand({
          readEnvironment: (environmentVariable) => environment[environmentVariable],
          runMode,
        });
        await runCommand(command, { rawArgs: ["author"] });
        return runMode;
      })
      .extend("zeroConcurrencyRunMode", async () => {
        const runMode = vi.fn<Parameters<typeof createAutoDevelopCommand>[0]["runMode"]>(() =>
          Promise.resolve(),
        );
        const environment: Readonly<Record<string, string>> = {
          AUTO_DEVELOP_RELAY_ORIGIN: "https://relay.example.test",
          GITHUB_REPOSITORY: "owner/repository",
          GH_TOKEN: "token",
        };
        const command = createAutoDevelopCommand({
          readEnvironment: (environmentVariable) => environment[environmentVariable],
          runMode,
        });
        await runCommand(command, { rawArgs: ["reviewer", "--concurrency", "0"] });
        return runMode;
      })
      .extend("nonnumericConcurrencyRunMode", async () => {
        const runMode = vi.fn<Parameters<typeof createAutoDevelopCommand>[0]["runMode"]>(() =>
          Promise.resolve(),
        );
        const environment: Readonly<Record<string, string>> = {
          AUTO_DEVELOP_RELAY_ORIGIN: "https://relay.example.test",
          GITHUB_REPOSITORY: "owner/repository",
          GH_TOKEN: "token",
        };
        const command = createAutoDevelopCommand({
          readEnvironment: (environmentVariable) => environment[environmentVariable],
          runMode,
        });
        await runCommand(command, {
          rawArgs: ["reviewer", "--concurrency", "not-a-number"],
        });
        return runMode;
      });

    it("reviewer mode へ正規化した filter と明示オプションを渡す", ({ reviewerRunMode }) => {
      expect(reviewerRunMode).toHaveBeenCalledExactlyOnceWith({
        mode: "reviewer",
        relayOrigin: "https://relay.example.test",
        repository: "owner/repository",
        githubToken: "primary-token",
        concurrency: 5,
        prFilter: { targetPrs: [7, 9], excludedPrs: [4] },
        dryRun: true,
        reviewerLogin: "review-bot",
        bypassPermissions: true,
        engineTimeoutMs: 259_200_000,
      });
    });

    it("author mode へ既定値と fallback GitHub token を渡す", ({ authorRunMode }) => {
      expect(authorRunMode).toHaveBeenCalledExactlyOnceWith({
        mode: "author",
        relayOrigin: "https://relay.example.test",
        repository: "owner/repository",
        githubToken: "fallback-token",
        concurrency: 3,
        prFilter: { targetPrs: [], excludedPrs: [] },
        dryRun: false,
        reviewerLogin: "",
        bypassPermissions: false,
        engineTimeoutMs: 259_200_000,
      });
    });

    it("0 の concurrency は既定値へ正規化する", ({ zeroConcurrencyRunMode }) => {
      expect(zeroConcurrencyRunMode).toHaveBeenCalledExactlyOnceWith({
        mode: "reviewer",
        relayOrigin: "https://relay.example.test",
        repository: "owner/repository",
        githubToken: "token",
        concurrency: 3,
        prFilter: { targetPrs: [], excludedPrs: [] },
        dryRun: false,
        reviewerLogin: "",
        bypassPermissions: false,
        engineTimeoutMs: 259_200_000,
      });
    });

    it("数値でない concurrency は既定値へ正規化する", ({ nonnumericConcurrencyRunMode }) => {
      expect(nonnumericConcurrencyRunMode).toHaveBeenCalledExactlyOnceWith({
        mode: "reviewer",
        relayOrigin: "https://relay.example.test",
        repository: "owner/repository",
        githubToken: "token",
        concurrency: 3,
        prFilter: { targetPrs: [], excludedPrs: [] },
        dryRun: false,
        reviewerLogin: "",
        bypassPermissions: false,
        engineTimeoutMs: 259_200_000,
      });
    });
  });

  describe("実行環境が欠けている場合", () => {
    const it = standardIoTest
      .extend("restoreExitCode", { auto: true }, ({}, { onCleanup }) => {
        onCleanup(() => {
          process.exitCode = 0;
        });
      })
      .extend("missingEnvironmentExitCode", { auto: true }, async () => {
        const missingEnvironments: readonly Readonly<Record<string, string>>[] = [
          { GITHUB_REPOSITORY: "owner/repository", GH_TOKEN: "token" },
          { AUTO_DEVELOP_RELAY_ORIGIN: "https://relay.example.test", GH_TOKEN: "token" },
          {
            AUTO_DEVELOP_RELAY_ORIGIN: "https://relay.example.test",
            GITHUB_REPOSITORY: "owner/repository",
          },
        ];
        for (const environment of missingEnvironments) {
          const command = createAutoDevelopCommand({
            readEnvironment: (environmentVariable) => environment[environmentVariable],
            runMode: () =>
              Promise.reject(new Error("missing environment must stop before runMode")),
          });
          await runCommand(command, { rawArgs: ["reviewer"] });
        }
        return Reflect.get(process, "exitCode");
      });

    it("終了コードを usage error にする", ({ missingEnvironmentExitCode }) => {
      expect(missingEnvironmentExitCode).toBe(EXIT_MISUSE);
    });

    it("標準出力には何も書かない", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [],
        }
      `);
    });

    it("不足診断を各構成について標準エラーへ書く", ({ stderr }) => {
      expect(stderr).toMatchInlineSnapshot(`
        {
          "chunks": [
            "AUTO_DEVELOP_RELAY_ORIGIN, GITHUB_REPOSITORY and GH_TOKEN (or GITHUB_TOKEN) must be set
        ",
            "AUTO_DEVELOP_RELAY_ORIGIN, GITHUB_REPOSITORY and GH_TOKEN (or GITHUB_TOKEN) must be set
        ",
            "AUTO_DEVELOP_RELAY_ORIGIN, GITHUB_REPOSITORY and GH_TOKEN (or GITHUB_TOKEN) must be set
        ",
          ],
        }
      `);
    });
  });
});
