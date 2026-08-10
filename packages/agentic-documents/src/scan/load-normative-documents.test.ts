import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { loadNormativeDocuments } from "./load-normative-documents.ts";

describe("loadNormativeDocuments", () => {
  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "normative-documents-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const [path, text] of Object.entries(files)) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text, "utf8");
    }
    return root;
  };

  test("every normative document below the root is read with its source and its tree", async () => {
    const repositoryRoot = repositoryWith({
      "AGENTS.md": "# root\n\n- MUST: 何かする\n",
      "packages/user/AGENTS.md": "# user\n",
      "packages/user/CLAUDE.md": "# not normative\n",
    });

    const documents = await loadNormativeDocuments({ repositoryRoot, config: defaultConfig });

    expect(documents.map((document) => document.file)).toStrictEqual([
      "AGENTS.md",
      "packages/user/AGENTS.md",
    ]);
    expect(documents[0]?.source).toBe("# root\n\n- MUST: 何かする\n");
    expect(documents[0]?.tree.type).toBe("root");
  });

  test("a repository that holds no normative document reads as none", async () => {
    const repositoryRoot = repositoryWith({ "README.md": "# read me\n" });

    expect(await loadNormativeDocuments({ repositoryRoot, config: defaultConfig })).toStrictEqual(
      [],
    );
  });

  test("a generated region in a document is remembered as a range", async () => {
    const repositoryRoot = repositoryWith({
      "AGENTS.md": "# root\n\n<!--VITE PLUS START-->\ngenerated\n<!--VITE PLUS END-->\n",
    });

    const documents = await loadNormativeDocuments({ repositoryRoot, config: defaultConfig });

    expect(documents[0]?.generated).toHaveLength(1);
  });
});
