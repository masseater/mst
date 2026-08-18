import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { normativeDocumentPlacesIn, normativeDocumentsIn } from "./normative-document-places.ts";

const WITHOUT_A_DECLARATION = { fileName: "AGENTS.md", directories: [] };

describe("normativeDocumentPlacesIn", () => {
  describe("a repository without a manifest", () => {
    const it = test.extend("places", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "normative-places-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return normativeDocumentPlacesIn(root);
    });

    it("names the document every repository is read through, and no place", ({ places }) => {
      expect(places).toStrictEqual(WITHOUT_A_DECLARATION);
    });
  });

  describe("a manifest that is not an object", () => {
    const it = test.extend("places", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "normative-places-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "package.json"), "[]", "utf8");
      return normativeDocumentPlacesIn(root);
    });

    it("reads it as no declaration", ({ places }) => {
      expect(places).toStrictEqual(WITHOUT_A_DECLARATION);
    });
  });

  describe("a manifest declaring nothing about its norms", () => {
    const it = test.extend("places", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "normative-places-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "package.json"), JSON.stringify({ name: "probe" }), "utf8");
      return normativeDocumentPlacesIn(root);
    });

    it("reads it as no declaration", ({ places }) => {
      expect(places).toStrictEqual(WITHOUT_A_DECLARATION);
    });
  });

  describe("a declaration naming both the document and the places", () => {
    const it = test.extend("places", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "normative-places-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({
          normativeDocuments: { fileName: "CONVENTIONS.md", directories: ["docs/norms"] },
        }),
        "utf8",
      );
      return normativeDocumentPlacesIn(root);
    });

    it("takes both from the declaration", ({ places }) => {
      expect(places).toStrictEqual({ fileName: "CONVENTIONS.md", directories: ["docs/norms"] });
    });
  });

  describe("a declaration whose fields are of the wrong shape", () => {
    const it = test.extend("places", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "normative-places-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ normativeDocuments: { fileName: 7, directories: "docs/norms" } }),
        "utf8",
      );
      return normativeDocumentPlacesIn(root);
    });

    it("falls back to what a repository without a declaration gets", ({ places }) => {
      expect(places).toStrictEqual(WITHOUT_A_DECLARATION);
    });
  });

  describe("a declaration listing something that is not a path", () => {
    const it = test.extend("places", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "normative-places-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ normativeDocuments: { directories: ["docs/norms", 7] } }),
        "utf8",
      );
      return normativeDocumentPlacesIn(root);
    });

    it("keeps the paths and drops the rest", ({ places }) => {
      expect(places).toStrictEqual({ fileName: "AGENTS.md", directories: ["docs/norms"] });
    });
  });
});

describe("normativeDocumentsIn", () => {
  describe("a place the repository holds at its root and under a workspace", () => {
    const it = test.extend("documents", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "normative-places-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "docs/norms/rationales"), { recursive: true });
      mkdirSync(join(root, "packages/example/docs/norms"), { recursive: true });
      writeFileSync(join(root, "docs/norms/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "docs/norms/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "docs/norms/rationales/why.md"), "# why\n", "utf8");
      writeFileSync(join(root, "packages/example/docs/norms/local.md"), "# local\n", "utf8");
      symlinkSync(join(root, "docs/norms/tests.md"), join(root, "docs/norms/linked.md"));
      return normativeDocumentsIn({
        repositoryRoot: root,
        places: { fileName: "AGENTS.md", directories: ["docs/norms"] },
        workspaceDirectories: ["packages/example"],
      });
    });

    it("takes the documents directly in each place, following no link", ({ documents }) => {
      expect(documents).toStrictEqual([
        "docs/norms/tests.md",
        "packages/example/docs/norms/local.md",
      ]);
    });
  });

  describe("a place the repository does not hold", () => {
    const it = test.extend("documents", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "normative-places-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return normativeDocumentsIn({
        repositoryRoot: root,
        places: { fileName: "AGENTS.md", directories: ["docs/norms"] },
        workspaceDirectories: [],
      });
    });

    it("finds nothing", ({ documents }) => {
      expect(documents).toStrictEqual([]);
    });
  });
});
