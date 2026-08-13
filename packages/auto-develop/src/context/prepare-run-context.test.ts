import { describe, expect, test, vi } from "vite-plus/test";

import { prepareRunContext } from "./prepare-run-context.ts";
import { LAUNCH_AUTO } from "./run-context.ts";

const baseRequest = {
  worktreePath: "/work/pr-7",
  launchPath: LAUNCH_AUTO,
  prNumber: 7,
  baseRef: "origin/main",
  headRef: "topic/x",
  prContextJsonPath: "/work/pr-7/ctx.json",
  prContextMarkdownPath: "/work/pr-7/ctx.md",
  failedCiLogsDir: "/work/pr-7/ci-logs",
};

describe("prepareRunContext", () => {
  describe("reviewer モードで組み上がる run context", () => {
    const it = test.extend("preparedReviewerRunContext", () => {
      const mkdirRecursive = vi.fn<(dir: string) => void>();
      const writeJson = vi.fn<(jsonPath: string, written: unknown) => void>();
      return prepareRunContext({
        request: { ...baseRequest, mode: "reviewer" },
        fs: { mkdirRecursive, writeJson },
        nowIso: () => "2026-08-11T00:00:00.000Z",
      });
    });

    it("実行 ID は PR 番号とタイムスタンプから決まる", ({ preparedReviewerRunContext }) => {
      expect(preparedReviewerRunContext).toStrictEqual({
        schemaVersion: 1,
        mode: "reviewer",
        launchPath: "auto",
        prNumber: 7,
        baseRef: "origin/main",
        headRef: "topic/x",
        createdAt: "2026-08-11T00:00:00.000Z",
        git: { worktreePath: "/work/pr-7" },
        artifacts: {
          prContextJsonPath: "/work/pr-7/ctx.json",
          prContextMarkdownPath: "/work/pr-7/ctx.md",
          failedCiLogsDir: "/work/pr-7/ci-logs",
        },
        workflow: {
          runId: "7-2026-08-11T00-00-00-000Z",
          runRootDir: "/work/pr-7/.repo-workflow/review/7-2026-08-11T00-00-00-000Z",
          findingsDir: "/work/pr-7/.repo-workflow/review/7-2026-08-11T00-00-00-000Z/findings",
          inventoryJsonPath:
            "/work/pr-7/.repo-workflow/review/7-2026-08-11T00-00-00-000Z/inventory.json",
          plannedCommentsJsonPath:
            "/work/pr-7/.repo-workflow/review/7-2026-08-11T00-00-00-000Z/planned-comments.json",
        },
      });
    });
  });

  describe("reviewer モードで作られるディレクトリ", () => {
    const it = test.extend("mkdirRecursiveDuringReviewerPreparation", () => {
      const mkdirRecursive = vi.fn<(dir: string) => void>();
      const writeJson = vi.fn<(jsonPath: string, written: unknown) => void>();
      prepareRunContext({
        request: { ...baseRequest, mode: "reviewer" },
        fs: { mkdirRecursive, writeJson },
        nowIso: () => "2026-08-11T00:00:00.000Z",
      });
      return mkdirRecursive;
    });

    it("findings のディレクトリを作る", ({ mkdirRecursiveDuringReviewerPreparation }) => {
      expect(mkdirRecursiveDuringReviewerPreparation).toHaveBeenCalledWith(
        "/work/pr-7/.repo-workflow/review/7-2026-08-11T00-00-00-000Z/findings",
      );
    });

    it("run context の親ディレクトリを作る", ({ mkdirRecursiveDuringReviewerPreparation }) => {
      expect(mkdirRecursiveDuringReviewerPreparation).toHaveBeenCalledWith(
        "/work/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-2026-08-11T00-00-00-000Z",
      );
    });
  });

  describe("reviewer モードで書き出される JSON", () => {
    const it = test.extend("writeJsonDuringReviewerPreparation", () => {
      const mkdirRecursive = vi.fn<(dir: string) => void>();
      const writeJson = vi.fn<(jsonPath: string, written: unknown) => void>();
      prepareRunContext({
        request: { ...baseRequest, mode: "reviewer" },
        fs: { mkdirRecursive, writeJson },
        nowIso: () => "2026-08-11T00:00:00.000Z",
      });
      return writeJson;
    });

    it("run context の JSON を書く", ({ writeJsonDuringReviewerPreparation }) => {
      expect(writeJsonDuringReviewerPreparation).toHaveBeenCalledWith(
        "/work/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-2026-08-11T00-00-00-000Z/run-context.json",
        {
          schemaVersion: 1,
          mode: "reviewer",
          launchPath: "auto",
          prNumber: 7,
          baseRef: "origin/main",
          headRef: "topic/x",
          createdAt: "2026-08-11T00:00:00.000Z",
          git: { worktreePath: "/work/pr-7" },
          artifacts: {
            prContextJsonPath: "/work/pr-7/ctx.json",
            prContextMarkdownPath: "/work/pr-7/ctx.md",
            failedCiLogsDir: "/work/pr-7/ci-logs",
          },
          workflow: {
            runId: "7-2026-08-11T00-00-00-000Z",
            runRootDir: "/work/pr-7/.repo-workflow/review/7-2026-08-11T00-00-00-000Z",
            findingsDir: "/work/pr-7/.repo-workflow/review/7-2026-08-11T00-00-00-000Z/findings",
            inventoryJsonPath:
              "/work/pr-7/.repo-workflow/review/7-2026-08-11T00-00-00-000Z/inventory.json",
            plannedCommentsJsonPath:
              "/work/pr-7/.repo-workflow/review/7-2026-08-11T00-00-00-000Z/planned-comments.json",
          },
        },
      );
    });
  });

  describe("author モードで書き出される JSON", () => {
    const it = test.extend("writeJsonDuringAuthorPreparation", () => {
      const mkdirRecursive = vi.fn<(dir: string) => void>();
      const writeJson = vi.fn<(jsonPath: string, written: unknown) => void>();
      prepareRunContext({
        request: { ...baseRequest, mode: "author" },
        fs: { mkdirRecursive, writeJson },
        nowIso: () => "2026-08-11T00:00:00.000Z",
      });
      return writeJson;
    });

    it("書き出す値はスキーマ検証を通った run context である", ({
      writeJsonDuringAuthorPreparation,
    }) => {
      expect(writeJsonDuringAuthorPreparation).toHaveBeenCalledWith(
        "/work/pr-7/.repo-workflow/auto-develop/run-context/author-7-2026-08-11T00-00-00-000Z/run-context.json",
        {
          schemaVersion: 1,
          mode: "author",
          launchPath: "auto",
          prNumber: 7,
          baseRef: "origin/main",
          headRef: "topic/x",
          createdAt: "2026-08-11T00:00:00.000Z",
          git: { worktreePath: "/work/pr-7" },
          artifacts: {
            prContextJsonPath: "/work/pr-7/ctx.json",
            prContextMarkdownPath: "/work/pr-7/ctx.md",
            failedCiLogsDir: "/work/pr-7/ci-logs",
          },
          workflow: {
            runId: "7-2026-08-11T00-00-00-000Z",
            runRootDir: "/work/pr-7/.repo-workflow/author/7-2026-08-11T00-00-00-000Z",
            findingsDir: "/work/pr-7/.repo-workflow/author/7-2026-08-11T00-00-00-000Z/findings",
            inventoryJsonPath:
              "/work/pr-7/.repo-workflow/author/7-2026-08-11T00-00-00-000Z/inventory.json",
            plannedCommentsJsonPath:
              "/work/pr-7/.repo-workflow/author/7-2026-08-11T00-00-00-000Z/planned-comments.json",
          },
        },
      );
    });
  });

  describe("author モードで組み上がる run context", () => {
    const it = test.extend("preparedAuthorRunContext", () => {
      const mkdirRecursive = vi.fn<(dir: string) => void>();
      const writeJson = vi.fn<(jsonPath: string, written: unknown) => void>();
      return prepareRunContext({
        request: { ...baseRequest, mode: "author" },
        fs: { mkdirRecursive, writeJson },
        nowIso: () => "2026-08-11T00:00:00.000Z",
      });
    });

    it("書き出す値は要求されたモードを持つ", ({ preparedAuthorRunContext }) => {
      expect(preparedAuthorRunContext).toStrictEqual({
        schemaVersion: 1,
        mode: "author",
        launchPath: "auto",
        prNumber: 7,
        baseRef: "origin/main",
        headRef: "topic/x",
        createdAt: "2026-08-11T00:00:00.000Z",
        git: { worktreePath: "/work/pr-7" },
        artifacts: {
          prContextJsonPath: "/work/pr-7/ctx.json",
          prContextMarkdownPath: "/work/pr-7/ctx.md",
          failedCiLogsDir: "/work/pr-7/ci-logs",
        },
        workflow: {
          runId: "7-2026-08-11T00-00-00-000Z",
          runRootDir: "/work/pr-7/.repo-workflow/author/7-2026-08-11T00-00-00-000Z",
          findingsDir: "/work/pr-7/.repo-workflow/author/7-2026-08-11T00-00-00-000Z/findings",
          inventoryJsonPath:
            "/work/pr-7/.repo-workflow/author/7-2026-08-11T00-00-00-000Z/inventory.json",
          plannedCommentsJsonPath:
            "/work/pr-7/.repo-workflow/author/7-2026-08-11T00-00-00-000Z/planned-comments.json",
        },
      });
    });
  });
});
