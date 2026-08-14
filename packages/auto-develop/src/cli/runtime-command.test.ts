import { standardIoTest } from "@mst/dont-review-it/vitest";
import { EXIT_MISUSE } from "@mst/repository-checks";
import { runCommand } from "citty";
import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { createAutoDevelopCommand } from "./runtime-command.ts";

import type { ModeRunRequest } from "./run-mode.ts";

const environmentReader = (environment: Readonly<Record<string, string>>) => (name: string) =>
  environment[name];

const invoke = async (invocation: {
  readonly rawArgs: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
}): Promise<ModeRunRequest | undefined> => {
  const captured = new Map<string, ModeRunRequest>();
  const command = createAutoDevelopCommand({
    readEnvironment: environmentReader(invocation.environment),
    runMode: (request) => {
      captured.set("request", request);
      return Promise.resolve();
    },
  });
  await runCommand(command, { rawArgs: [...invocation.rawArgs] });
  return captured.get("request");
};

describe("createAutoDevelopCommand", () => {
  test("starts reviewer mode with normalized filters and explicit runtime options", async () => {
    const request = await invoke({
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
      environment: {
        AUTO_DEVELOP_RELAY_ORIGIN: "https://relay.example.test",
        GITHUB_REPOSITORY: "owner/repository",
        GH_TOKEN: "primary-token",
      },
    });

    expect(request).toStrictEqual({
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

  test("starts author mode with defaults and the fallback GitHub token", async () => {
    const request = await invoke({
      rawArgs: ["author"],
      environment: {
        AUTO_DEVELOP_RELAY_ORIGIN: "https://relay.example.test",
        GITHUB_REPOSITORY: "owner/repository",
        GITHUB_TOKEN: "fallback-token",
      },
    });

    expect(request).toStrictEqual({
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

  test.each(["0", "not-a-number"])(
    "uses the default concurrency when %s is not a positive integer",
    async (concurrency) => {
      const request = await invoke({
        rawArgs: ["reviewer", "--concurrency", concurrency],
        environment: {
          AUTO_DEVELOP_RELAY_ORIGIN: "https://relay.example.test",
          GITHUB_REPOSITORY: "owner/repository",
          GH_TOKEN: "token",
        },
      });

      expect(request?.concurrency).toBe(3);
    },
  );

  const missingEnvironments: readonly Readonly<Record<string, string>>[] = [
    {
      GITHUB_REPOSITORY: "owner/repository",
      GH_TOKEN: "token",
    },
    {
      AUTO_DEVELOP_RELAY_ORIGIN: "https://relay.example.test",
      GH_TOKEN: "token",
    },
    {
      AUTO_DEVELOP_RELAY_ORIGIN: "https://relay.example.test",
      GITHUB_REPOSITORY: "owner/repository",
    },
  ];

  standardIoTest("rejects missing runtime environment", async ({ stdout, stderr }) => {
    onTestFinished(() => {
      process.exitCode = 0;
    });
    for (const environment of missingEnvironments) {
      process.exitCode = 0;
      const request = await invoke({ rawArgs: ["reviewer"], environment });
      expect(request).toBeUndefined();
      expect(process.exitCode).toBe(EXIT_MISUSE);
    }

    expect(stdout.text).toMatchInlineSnapshot(`""`);
    expect(stderr.text).toMatchInlineSnapshot(`
      "AUTO_DEVELOP_RELAY_ORIGIN, GITHUB_REPOSITORY and GH_TOKEN (or GITHUB_TOKEN) must be set
      AUTO_DEVELOP_RELAY_ORIGIN, GITHUB_REPOSITORY and GH_TOKEN (or GITHUB_TOKEN) must be set
      AUTO_DEVELOP_RELAY_ORIGIN, GITHUB_REPOSITORY and GH_TOKEN (or GITHUB_TOKEN) must be set
      "
    `);
  });
});
