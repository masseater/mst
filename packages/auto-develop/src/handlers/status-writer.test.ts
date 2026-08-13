import { describe, expect, test, vi } from "vite-plus/test";

import { createLifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import { silentLogger } from "../logging/logger.ts";
import { createStatusWriter } from "./status-writer.ts";

import type { HandlerGithubClient } from "./github-client.ts";

describe("createStatusWriter", () => {
  describe("世代ゲートを持たない writer", () => {
    const it = test
      .extend("commitStatusCreatorAfterUngatedWrite", async () => {
        const createCommitStatus = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
          Promise.resolve(),
        );
        const writer = createStatusWriter({
          github: {
            prSnapshot: () => Promise.reject(new Error("not used")),
            createCommitStatus,
            listReviews: () => Promise.resolve([]),
            requestReviewers: () => Promise.resolve(),
          },
          context: "ctx",
          log: silentLogger,
        });
        await writer.write({ sha: "abc", state: "pending", description: "reviewing" });
        return createCommitStatus;
      })
      .extend("ungatedStatusWasWritten", async () => {
        const createCommitStatus = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
          Promise.resolve(),
        );
        const writer = createStatusWriter({
          github: {
            prSnapshot: () => Promise.reject(new Error("not used")),
            createCommitStatus,
            listReviews: () => Promise.resolve([]),
            requestReviewers: () => Promise.resolve(),
          },
          context: "ctx",
          log: silentLogger,
        });
        return writer.write({ sha: "abc", state: "pending", description: "reviewing" });
      });

    it("書き込みは GitHub へ渡る", ({ commitStatusCreatorAfterUngatedWrite }) => {
      expect(commitStatusCreatorAfterUngatedWrite).toHaveBeenCalledWith({
        sha: "abc",
        state: "pending",
        context: "ctx",
        description: "reviewing",
      });
    });

    it("書き込みは書けたことを返す", ({ ungatedStatusWasWritten }) => {
      expect(ungatedStatusWasWritten).toBe(true);
    });
  });

  describe("世代が進んだ writer", () => {
    const it = test
      .extend("commitStatusCreatorAfterStaleWrite", async () => {
        const createCommitStatus = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
          Promise.resolve(),
        );
        const gate = createLifecycleGate();
        gate.interruptForInputChange(7);
        const writer = createStatusWriter({
          github: {
            prSnapshot: () => Promise.reject(new Error("not used")),
            createCommitStatus,
            listReviews: () => Promise.resolve([]),
            requestReviewers: () => Promise.resolve(),
          },
          context: "ctx",
          log: silentLogger,
          guard: { gate, prNumber: 7, generation: 0 },
        });
        await writer.write({ sha: "abc", state: "success", description: "done" });
        return createCommitStatus;
      })
      .extend("staleGenerationStatusWasWritten", async () => {
        const createCommitStatus = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
          Promise.resolve(),
        );
        const gate = createLifecycleGate();
        gate.interruptForInputChange(7);
        const writer = createStatusWriter({
          github: {
            prSnapshot: () => Promise.reject(new Error("not used")),
            createCommitStatus,
            listReviews: () => Promise.resolve([]),
            requestReviewers: () => Promise.resolve(),
          },
          context: "ctx",
          log: silentLogger,
          guard: { gate, prNumber: 7, generation: 0 },
        });
        return writer.write({ sha: "abc", state: "success", description: "done" });
      });

    it("GitHub を呼ばない", ({ commitStatusCreatorAfterStaleWrite }) => {
      expect(commitStatusCreatorAfterStaleWrite).not.toHaveBeenCalled();
    });

    it("書かなかったことを返す", ({ staleGenerationStatusWasWritten }) => {
      expect(staleGenerationStatusWasWritten).toBe(false);
    });
  });

  describe("世代が現在のままの writer", () => {
    const it = test.extend("commitStatusCreatorAfterCurrentWrite", async () => {
      const createCommitStatus = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      const gate = createLifecycleGate();
      const writer = createStatusWriter({
        github: {
          prSnapshot: () => Promise.reject(new Error("not used")),
          createCommitStatus,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        context: "ctx",
        log: silentLogger,
        guard: { gate, prNumber: 7, generation: 0 },
      });
      await writer.write({ sha: "abc", state: "success", description: "done" });
      return createCommitStatus;
    });

    it("GitHub へ書く", ({ commitStatusCreatorAfterCurrentWrite }) => {
      expect(commitStatusCreatorAfterCurrentWrite).toHaveBeenCalledTimes(1);
    });
  });

  describe("GitHub API が落ちている writer", () => {
    const it = test
      .extend("failingApiStatusWasWritten", async () => {
        const writer = createStatusWriter({
          github: {
            prSnapshot: () => Promise.reject(new Error("not used")),
            createCommitStatus: () => Promise.reject(new Error("GitHub is down")),
            listReviews: () => Promise.resolve([]),
            requestReviewers: () => Promise.resolve(),
          },
          context: "ctx",
          log: silentLogger,
        });
        return writer.write({ sha: "abc", state: "failure", description: "failed" });
      })
      .extend("warningLoggerAfterFailingApiWrite", async () => {
        const warn = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
        const writer = createStatusWriter({
          github: {
            prSnapshot: () => Promise.reject(new Error("not used")),
            createCommitStatus: () => Promise.reject(new Error("GitHub is down")),
            listReviews: () => Promise.resolve([]),
            requestReviewers: () => Promise.resolve(),
          },
          context: "ctx",
          log: { ...silentLogger, warn },
        });
        await writer.write({ sha: "abc", state: "failure", description: "failed" });
        return warn;
      });

    it("警告のみで書けた扱いにする", ({ failingApiStatusWasWritten }) => {
      expect(failingApiStatusWasWritten).toBe(true);
    });

    it("警告ログを 1 本残す", ({ warningLoggerAfterFailingApiWrite }) => {
      expect(warningLoggerAfterFailingApiWrite).toHaveBeenCalledTimes(1);
    });
  });
});
