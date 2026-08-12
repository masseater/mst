import { describe, expect, test, vi } from "vite-plus/test";

import { createLifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import { silentLogger } from "../logging/logger.ts";
import { createStatusWriter } from "./status-writer.ts";

import type { HandlerGithubClient } from "./github-client.ts";

const recordingGithub = (): {
  readonly github: HandlerGithubClient;
  readonly created: ReturnType<typeof vi.fn<HandlerGithubClient["createCommitStatus"]>>;
} => {
  const createdOne = vi.fn<HandlerGithubClient["createCommitStatus"]>(() => Promise.resolve());
  return {
    github: {
      prSnapshot: () => Promise.reject(new Error("not used")),
      createCommitStatus: createdOne,
      listReviews: () => Promise.resolve([]),
      requestReviewers: () => Promise.resolve(),
    },
    created: createdOne,
  };
};

const it = test
  .extend("ungatedWrite", async () => {
    const { github, created } = recordingGithub();
    const writer = createStatusWriter({ github, context: "ctx", log: silentLogger });
    const wrote = await writer.write({ sha: "abc", state: "pending", description: "reviewing" });
    return { wrote, calls: created.mock.calls };
  })
  .extend("staleGenerationWrite", async () => {
    const { github, created } = recordingGithub();
    const gate = createLifecycleGate();
    gate.interruptForInputChange(7);
    const writer = createStatusWriter({
      github,
      context: "ctx",
      log: silentLogger,
      guard: { gate, prNumber: 7, generation: 0 },
    });
    const wrote = await writer.write({ sha: "abc", state: "success", description: "done" });
    return { wrote, calls: created.mock.calls };
  })
  .extend("currentGenerationWrite", async () => {
    const { github, created } = recordingGithub();
    const gate = createLifecycleGate();
    const writer = createStatusWriter({
      github,
      context: "ctx",
      log: silentLogger,
      guard: { gate, prNumber: 7, generation: 0 },
    });
    const wrote = await writer.write({ sha: "abc", state: "success", description: "done" });
    return { wrote, calls: created.mock.calls };
  })
  .extend("failingApiWrite", async () => {
    const github: HandlerGithubClient = {
      prSnapshot: () => Promise.reject(new Error("not used")),
      createCommitStatus: () => Promise.reject(new Error("GitHub is down")),
      listReviews: () => Promise.resolve([]),
      requestReviewers: () => Promise.resolve(),
    };
    const warn = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
    const writer = createStatusWriter({
      github,
      context: "ctx",
      log: { ...silentLogger, warn },
    });
    const wrote = await writer.write({ sha: "abc", state: "failure", description: "failed" });
    return { wrote, warnings: warn.mock.calls.length };
  });

describe("createStatusWriter", () => {
  it("世代ゲートなしの書き込みは GitHub へ渡る", ({ ungatedWrite }) => {
    expect(ungatedWrite.calls).toStrictEqual([
      [{ sha: "abc", state: "pending", context: "ctx", description: "reviewing" }],
    ]);
  });

  it("世代ゲートなしの書き込みは書けたことを返す", ({ ungatedWrite }) => {
    expect(ungatedWrite.wrote).toStrictEqual(true);
  });

  it("世代が進んでいれば GitHub を呼ばない", ({ staleGenerationWrite }) => {
    expect(staleGenerationWrite.calls).toStrictEqual([]);
  });

  it("世代が進んでいれば書かなかったことを返す", ({ staleGenerationWrite }) => {
    expect(staleGenerationWrite.wrote).toStrictEqual(false);
  });

  it("世代が現在のままなら GitHub へ書く", ({ currentGenerationWrite }) => {
    expect(currentGenerationWrite.calls.length).toStrictEqual(1);
  });

  it("API 失敗は警告のみで書けた扱いにする", ({ failingApiWrite }) => {
    expect(failingApiWrite.wrote).toStrictEqual(true);
  });

  it("API 失敗は警告ログを 1 本残す", ({ failingApiWrite }) => {
    expect(failingApiWrite.warnings).toStrictEqual(1);
  });
});
