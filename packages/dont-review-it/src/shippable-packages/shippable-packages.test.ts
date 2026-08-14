import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultShippablePackagesConfig } from "./config.ts";
import { shippablePackagesProblems } from "./shippable-packages.ts";

describe("shippablePackagesProblems", () => {
  describe("a published package depending on a workspace nobody can install", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-shippable-packages-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const withheld = join(repositoryRoot, "packages/internal/package.json");
      const shipped = join(repositoryRoot, "packages/shipped/package.json");
      mkdirSync(dirname(withheld), { recursive: true });
      mkdirSync(dirname(shipped), { recursive: true });
      writeFileSync(
        withheld,
        `{
  "name": "@example/internal",
  "private": true
}
`,
        "utf8",
      );
      writeFileSync(
        shipped,
        `{
  "name": "@example/shipped",
  "dependencies": {
    "@example/internal": "workspace:*"
  }
}
`,
        "utf8",
      );
      return shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it("is told at the dependencies field to let the build absorb it", ({ scan }) => {
      expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/shipped/package.json",
              "line": 3,
              "message": "A package that npm can publish must not declare dependencies on @example/internal, because that workspace is marked "private": true and no registry ever serves it. Move it to devDependencies so the build bundles it, or let it publish by removing "private": true.",
            },
          ],
          "scanned": 1,
        }
      `);
    });
  });

  describe("a published package keeping that workspace in devDependencies", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-shippable-packages-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const withheld = join(repositoryRoot, "packages/internal/package.json");
      const shipped = join(repositoryRoot, "packages/shipped/package.json");
      mkdirSync(dirname(withheld), { recursive: true });
      mkdirSync(dirname(shipped), { recursive: true });
      writeFileSync(
        withheld,
        `{
  "name": "@example/internal",
  "private": true
}
`,
        "utf8",
      );
      writeFileSync(
        shipped,
        `{
  "name": "@example/shipped",
  "devDependencies": {
    "@example/internal": "workspace:*"
  }
}
`,
        "utf8",
      );
      return shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it("is left alone, because nothing an installer resolves names it", ({ scan }) => {
      expect(scan).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a published package whose bin points at TypeScript source", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-shippable-packages-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/shipped/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/shipped",
  "bin": {
    "shipped": "./src/cli.ts"
  }
}
`,
        "utf8",
      );
      return shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it("is told at the bin field to name the built output", ({ scan }) => {
      expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/shipped/package.json",
              "line": 3,
              "message": "The published bin.shipped entry must not point at ./src/cli.ts, because Node refuses to strip types from a file under node_modules and an installer finds nothing it can run there. Point it at the built output, through publishConfig when the local path has to stay on the source.",
            },
          ],
          "scanned": 1,
        }
      `);
    });
  });

  describe("a published package replacing its source entries at publish time", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-shippable-packages-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/shipped/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/shipped",
  "files": ["dist"],
  "bin": {
    "shipped": "./src/cli.ts"
  },
  "exports": {
    ".": "./src/index.ts"
  },
  "publishConfig": {
    "bin": {
      "shipped": "./dist/cli.mjs"
    },
    "exports": {
      ".": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      }
    }
  }
}
`,
        "utf8",
      );
      return shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it("is left alone, because what publishes resolves without stripping", ({ scan }) => {
      expect(scan).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a published package whose replacement still names source", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-shippable-packages-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/shipped/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/shipped",
  "files": ["src"],
  "publishConfig": {
    "exports": {
      ".": "./src/index.ts"
    }
  }
}
`,
        "utf8",
      );
      return shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it("is told at the publishConfig block that carries the replacement", ({ scan }) => {
      expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/shipped/package.json",
              "line": 4,
              "message": "The published exports["."] entry must not point at ./src/index.ts, because Node refuses to strip types from a file under node_modules and an installer finds nothing it can run there. Point it at the built output, through publishConfig when the local path has to stay on the source.",
            },
          ],
          "scanned": 1,
        }
      `);
    });
  });

  describe("a published package whose files allowlist drops the built output", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-shippable-packages-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/shipped/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/shipped",
  "files": ["skills"],
  "exports": {
    ".": "./dist/index.mjs",
    "./package.json": "./package.json"
  }
}
`,
        "utf8",
      );
      return shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it("is told at the files allowlist to carry what the entry names", ({ scan }) => {
      expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/shipped/package.json",
              "line": 3,
              "message": "The files allowlist must not leave out dist, because npm packs only what files names and a published entry would resolve to a path the archive never carried. Add "dist" to files.",
            },
          ],
          "scanned": 1,
        }
      `);
    });
  });

  describe("a published package without a files allowlist", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-shippable-packages-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/shipped/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/shipped",
  "exports": {
    ".": "./dist/index.mjs"
  }
}
`,
        "utf8",
      );
      return shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it("is left alone, because a manifest without the allowlist packs all", ({ scan }) => {
      expect(scan).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a manifest that holds nothing", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-shippable-packages-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "fixtures/empty/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(manifest, "", "utf8");
      return shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it("is counted by nothing, because it names no package", ({ scan }) => {
      expect(scan).toStrictEqual({ problems: [], scanned: 0 });
    });
  });

  describe("a manifest without a name", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-shippable-packages-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "fixtures/fragment/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(
        manifest,
        `{ "sideEffects": false }
`,
        "utf8",
      );
      return shippablePackagesProblems({
        repositoryRoot,
        config: defaultShippablePackagesConfig,
      });
    });

    it("is counted by nothing, because it names no package", ({ scan }) => {
      expect(scan).toStrictEqual({ problems: [], scanned: 0 });
    });
  });
});
