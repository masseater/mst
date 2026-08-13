import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { loadNormativeDocuments } from "./load-normative-documents.ts";

describe("loadNormativeDocuments", () => {
  describe("a repository holding normative documents beside companion files", () => {
    const it = test.extend("documents", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "normative-documents-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [path, text] of Object.entries({
        "AGENTS.md": "root\n",
        "packages/user/AGENTS.md": "user\n",
        "packages/user/CLAUDE.md": "companion\n",
      })) {
        const target = join(repositoryRoot, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text, "utf8");
      }
      return loadNormativeDocuments({ repositoryRoot, config: defaultConfig });
    });

    it("reads every normative document below the root with its source and its tree", ({
      documents,
    }) => {
      expect(documents).toStrictEqual([
        {
          file: "AGENTS.md",
          source: "root\n",
          generated: [],
          tree: {
            type: "root",
            children: [
              {
                type: "paragraph",
                children: [
                  {
                    type: "text",
                    value: "root",
                    position: {
                      start: { line: 1, column: 1, offset: 0 },
                      end: { line: 1, column: 5, offset: 4 },
                    },
                  },
                ],
                position: {
                  start: { line: 1, column: 1, offset: 0 },
                  end: { line: 1, column: 5, offset: 4 },
                },
              },
            ],
            position: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 2, column: 1, offset: 5 },
            },
          },
        },
        {
          file: "packages/user/AGENTS.md",
          source: "user\n",
          generated: [],
          tree: {
            type: "root",
            children: [
              {
                type: "paragraph",
                children: [
                  {
                    type: "text",
                    value: "user",
                    position: {
                      start: { line: 1, column: 1, offset: 0 },
                      end: { line: 1, column: 5, offset: 4 },
                    },
                  },
                ],
                position: {
                  start: { line: 1, column: 1, offset: 0 },
                  end: { line: 1, column: 5, offset: 4 },
                },
              },
            ],
            position: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 2, column: 1, offset: 5 },
            },
          },
        },
      ]);
    });
  });

  describe("a repository holding no normative document", () => {
    const it = test.extend("documents", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "normative-documents-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "README.md"), "# read me\n", "utf8");
      return loadNormativeDocuments({ repositoryRoot, config: defaultConfig });
    });

    it("reads as none at all", ({ documents }) => {
      expect(documents).toStrictEqual([]);
    });
  });

  describe("a normative document holding a generated region", () => {
    const it = test.extend("documents", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "normative-documents-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "AGENTS.md"),
        "<!--VITE PLUS START-->\ngenerated\n<!--VITE PLUS END-->\n",
        "utf8",
      );
      return loadNormativeDocuments({ repositoryRoot, config: defaultConfig });
    });

    it("remembers the region as a range beside the source and the tree", ({ documents }) => {
      expect(documents).toStrictEqual([
        {
          file: "AGENTS.md",
          source: "<!--VITE PLUS START-->\ngenerated\n<!--VITE PLUS END-->\n",
          generated: [{ startOffset: 0, endOffset: 53 }],
          tree: {
            type: "root",
            children: [
              {
                type: "html",
                value: "<!--VITE PLUS START-->",
                position: {
                  start: { line: 1, column: 1, offset: 0 },
                  end: { line: 1, column: 23, offset: 22 },
                },
              },
              {
                type: "paragraph",
                children: [
                  {
                    type: "text",
                    value: "generated",
                    position: {
                      start: { line: 2, column: 1, offset: 23 },
                      end: { line: 2, column: 10, offset: 32 },
                    },
                  },
                ],
                position: {
                  start: { line: 2, column: 1, offset: 23 },
                  end: { line: 2, column: 10, offset: 32 },
                },
              },
              {
                type: "html",
                value: "<!--VITE PLUS END-->",
                position: {
                  start: { line: 3, column: 1, offset: 33 },
                  end: { line: 3, column: 21, offset: 53 },
                },
              },
            ],
            position: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 4, column: 1, offset: 54 },
            },
          },
        },
      ]);
    });
  });
});
