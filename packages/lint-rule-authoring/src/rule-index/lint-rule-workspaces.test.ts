import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attempt } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { lintRuleWorkspacesIn } from "./lint-rule-workspaces.ts";

const DECLARING_MANIFEST = JSON.stringify({ name: "example", lintRules: ["src/rules"] });

describe("lintRuleWorkspacesIn", () => {
  describe("a repository without a workspace definition", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return lintRuleWorkspacesIn(root);
    });

    it("declares nothing", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([]);
    });
  });

  describe("a workspace definition that is a bare scalar", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "42\n", "utf8");
      return lintRuleWorkspacesIn(root);
    });

    it("declares nothing", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([]);
    });
  });

  describe("an empty workspace definition", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "", "utf8");
      return lintRuleWorkspacesIn(root);
    });

    it("declares nothing", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([]);
    });
  });

  describe("a workspace definition that does not parse", () => {
    const it = test.extend("failureMessage", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: [packages/*\n", "utf8");
      const [failure] = attempt<unknown, Error>(() => lintRuleWorkspacesIn(root));
      return failure === null ? null : failure.message;
    });

    it("is raised instead of being skipped", ({ failureMessage }) => {
      expect(failureMessage).toBe("pnpm-workspace.yaml exists but does not parse as YAML");
    });
  });

  describe("a definition whose packages field is not a list", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: 7\n", "utf8");
      return lintRuleWorkspacesIn(root);
    });

    it("declares nothing", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([]);
    });
  });

  describe("a pattern that is not a word standing beside one that is", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example"), { recursive: true });
      writeFileSync(
        join(root, "pnpm-workspace.yaml"),
        "packages:\n  - 7\n  - packages/*\n",
        "utf8",
      );
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      return lintRuleWorkspacesIn(root);
    });

    it("is left out while the others expand", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([
        { workspaceDir: "packages/example", ruleDirectories: ["src/rules"] },
      ]);
    });
  });

  describe("a pattern naming one directory", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "tools/single"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - tools/single\n", "utf8");
      writeFileSync(join(root, "tools/single/package.json"), DECLARING_MANIFEST, "utf8");
      return lintRuleWorkspacesIn(root);
    });

    it("is taken as it stands", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([
        { workspaceDir: "tools/single", ruleDirectories: ["src/rules"] },
      ]);
    });
  });

  describe("a pattern whose parent directory does not exist", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - missing/*\n", "utf8");
      return lintRuleWorkspacesIn(root);
    });

    it("expands to nothing", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([]);
    });
  });

  describe("a file sitting beside the workspaces", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(join(root, "packages/stray.txt"), "not a workspace", "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      return lintRuleWorkspacesIn(root);
    });

    it("is not taken for one", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([
        { workspaceDir: "packages/example", ruleDirectories: ["src/rules"] },
      ]);
    });
  });

  describe("a workspace without a manifest", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(join(root, "packages/example/readme.md"), "no manifest here", "utf8");
      return lintRuleWorkspacesIn(root);
    });

    it("declares nothing", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([]);
    });
  });

  describe("a manifest that is not an object", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/scalar"), { recursive: true });
      mkdirSync(join(root, "packages/nothing"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(join(root, "packages/scalar/package.json"), "42", "utf8");
      writeFileSync(join(root, "packages/nothing/package.json"), "null", "utf8");
      return lintRuleWorkspacesIn(root);
    });

    it("declares nothing", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([]);
    });
  });

  describe("a manifest that cannot be parsed", () => {
    const it = test.extend("failureName", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/broken"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(join(root, "packages/broken/package.json"), "{ not json", "utf8");
      const [failure] = attempt<unknown, Error>(() => lintRuleWorkspacesIn(root));
      return failure === null ? null : failure.name;
    });

    it("is raised instead of being skipped", ({ failureName }) => {
      expect(failureName).toBe("SyntaxError");
    });
  });

  describe("a manifest without a lintRules list", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/plain"), { recursive: true });
      mkdirSync(join(root, "packages/wrong"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(
        join(root, "packages/plain/package.json"),
        JSON.stringify({ name: "plain" }),
        "utf8",
      );
      writeFileSync(
        join(root, "packages/wrong/package.json"),
        JSON.stringify({ name: "wrong", lintRules: "src/rules" }),
        "utf8",
      );
      return lintRuleWorkspacesIn(root);
    });

    it("declares nothing", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([]);
    });
  });

  describe("declared directories holding an entry that is not a word", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/mixed"), { recursive: true });
      mkdirSync(join(root, "packages/hollow"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(
        join(root, "packages/mixed/package.json"),
        JSON.stringify({ lintRules: [7, "src/rules"] }),
        "utf8",
      );
      writeFileSync(
        join(root, "packages/hollow/package.json"),
        JSON.stringify({ lintRules: [7] }),
        "utf8",
      );
      return lintRuleWorkspacesIn(root);
    });

    it("drops that entry and keeps the workspace that has words left", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([
        { workspaceDir: "packages/mixed", ruleDirectories: ["src/rules"] },
      ]);
    });
  });

  describe("two workspaces declared out of order", () => {
    const it = test.extend("workspaces", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-workspaces-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/zebra"), { recursive: true });
      mkdirSync(join(root, "packages/alpha"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(join(root, "packages/zebra/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, "packages/alpha/package.json"), DECLARING_MANIFEST, "utf8");
      return lintRuleWorkspacesIn(root);
    });

    it("come back sorted by their directory", ({ workspaces }) => {
      expect(workspaces).toStrictEqual([
        { workspaceDir: "packages/alpha", ruleDirectories: ["src/rules"] },
        { workspaceDir: "packages/zebra", ruleDirectories: ["src/rules"] },
      ]);
    });
  });
});
