import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultEntryCompositionConfig } from "./config.ts";
import { entryCompositionProblems } from "./entry-composition-problems.ts";

const ROOT_PREFIX = "throttle --timeout 1800 -- spool -- ";

const WORKSPACE_PREFIX = "spool -- ";

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

describe("entryCompositionProblems", () => {
  describe("a repository whose entries all carry their layer prefix", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      mkdirSync(join(repositoryRoot, "packages/web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages/web/package.json"),
        `{ "scripts": { "test": "${WORKSPACE_PREFIX}vp test", "build": "${WORKSPACE_PREFIX}vp pack" } }`,
        "utf8",
      );
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("says nothing about either layer", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], failures: [], scanned: 2 });
    });
  });

  describe("a required entry missing from an existing scripts section", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{\n  "name": "x",\n  "scripts": {\n    "lint": "vp lint"\n  }\n}\n`,
        "utf8",
      );
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("names the entry at the line the scripts section opens on", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "package.json",
            line: 3,
            message: `The required "guard" script must not be missing. Add "guard" with a value that starts with "${ROOT_PREFIX}".`,
          },
        ],
        failures: [],
        scanned: 1,
      });
    });
  });

  describe("a manifest holding no scripts section at all", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "package.json"), `{\n  "name": "x"\n}\n`, "utf8");
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("reports the missing section apart from a missing entry and points at no line", ({
      report,
    }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "package.json",
            line: null,
            message: `The scripts section holding the required "guard" entry must not be missing. Add a scripts section whose "guard" value starts with "${ROOT_PREFIX}".`,
          },
        ],
        failures: [],
        scanned: 1,
      });
    });
  });

  describe("a required entry whose head is not the required prefix", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{\n  "name": "x",\n  "scripts": {\n    "guard": "vp check"\n  }\n}\n`,
        "utf8",
      );
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("states the actual head beside the required prefix", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "package.json",
            line: 4,
            message: `The "guard" script must not start with "vp check". Rewrite the value to start with the required prefix "${ROOT_PREFIX}".`,
          },
        ],
        failures: [],
        scanned: 1,
      });
    });
  });

  describe("a value whose wrapper column is complete but reversed", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "spool -- throttle --timeout 1800 -- vp check" } }`,
        "utf8",
      );
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("reads the reversed column as the head it must not start with", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "package.json",
            line: 1,
            message: `The "guard" script must not start with "spool -- throttle --timeout 1800 -- ". Rewrite the value to start with the required prefix "${ROOT_PREFIX}".`,
          },
        ],
        failures: [],
        scanned: 1,
      });
    });
  });

  describe("a workspace manifest that declares none of the guarded names", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      mkdirSync(join(repositoryRoot, "packages/web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages/web/package.json"),
        `{ "scripts": { "lint": "vp lint" } }`,
        "utf8",
      );
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("says nothing about the names it never declared", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], failures: [], scanned: 2 });
    });
  });

  describe("a declared workspace entry that lacks the workspace prefix", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      mkdirSync(join(repositoryRoot, "packages/web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages/web/package.json"),
        `{ "scripts": { "check": "vp check" } }`,
        "utf8",
      );
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("asks for the workspace prefix rather than the root one", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "packages/web/package.json",
            line: 1,
            message: `The "check" script must not start with "vp check". Rewrite the value to start with the required prefix "${WORKSPACE_PREFIX}".`,
          },
        ],
        failures: [],
        scanned: 2,
      });
    });
  });

  describe("a workspace entry that puts the upper wrapper at its head", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      mkdirSync(join(repositoryRoot, "packages/web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages/web/package.json"),
        `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
        "utf8",
      );
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("reports that workspace manifest for a head the workspace layer never asked for", ({
      report,
    }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "packages/web/package.json",
            line: 1,
            message: `The "test" script must not start with "throttle ". Rewrite the value to start with the required prefix "${WORKSPACE_PREFIX}".`,
          },
        ],
        failures: [],
        scanned: 2,
      });
    });
  });

  describe("a script whose value is not a string", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "package.json"), `{ "scripts": { "guard": 1 } }`, "utf8");
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("reads it as an empty head", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "package.json",
            line: 1,
            message: `The "guard" script must not start with "". Rewrite the value to start with the required prefix "${ROOT_PREFIX}".`,
          },
        ],
        failures: [],
        scanned: 1,
      });
    });
  });

  describe("a repository holding no root manifest", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      mkdirSync(join(repositoryRoot, "packages/web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages/web/package.json"),
        `{ "scripts": { "check": "vp check" } }`,
        "utf8",
      );
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("leaves the absent manifest out of the enumeration and still walks the workspaces", ({
      report,
    }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "packages/web/package.json",
            line: 1,
            message: `The "check" script must not start with "vp check". Rewrite the value to start with the required prefix "${WORKSPACE_PREFIX}".`,
          },
        ],
        failures: [],
        scanned: 1,
      });
    });
  });

  describe("definitions written outside the manifests and patterns matching nothing", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n  - docs\n  - '!ignored'\n  - .\n  - 1\n",
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "scripts"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "scripts/heavy.sh"),
        "vp run -r test --coverage\n",
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages/empty"), { recursive: true });
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("keeps both of them out of its sight", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], failures: [], scanned: 1 });
    });
  });

  describe("a root manifest that does not parse", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "package.json"), "{ oops", "utf8");
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("becomes a failure of the check itself rather than a problem", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        failures: [
          "package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
        ],
        scanned: 0,
      });
    });
  });

  describe("a root manifest that is empty", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "package.json"), "", "utf8");
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("becomes a failure of the check itself", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        failures: [
          "package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
        ],
        scanned: 0,
      });
    });
  });

  describe("a root manifest that parses into something other than an object", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "package.json"), "[]", "utf8");
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("becomes a failure of the check itself", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        failures: [
          "package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
        ],
        scanned: 0,
      });
    });
  });

  describe("a root manifest that exists but cannot be read", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "package.json"));
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("becomes a failure of the check itself", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        failures: [
          "package.json exists but cannot be read, so the entry composition check did not run.",
        ],
        scanned: 0,
      });
    });
  });

  describe("a workspace manifest that does not parse", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "vp check" } }`,
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      mkdirSync(join(repositoryRoot, "packages/web"), { recursive: true });
      writeFileSync(join(repositoryRoot, "packages/web/package.json"), "{ oops", "utf8");
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("becomes a failure without silencing the layer that did parse", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "package.json",
            line: 1,
            message: `The "guard" script must not start with "vp check". Rewrite the value to start with the required prefix "${ROOT_PREFIX}".`,
          },
        ],
        failures: [
          "packages/web/package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
        ],
        scanned: 1,
      });
    });
  });

  describe("a workspace definition that does not parse as YAML", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "packages: [\n", "utf8");
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("becomes a failure of the check itself", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        failures: [
          "pnpm-workspace.yaml exists but does not parse as YAML, so the entry composition check did not run.",
        ],
        scanned: 1,
      });
    });
  });

  describe("a workspace definition that cannot be read", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "pnpm-workspace.yaml"));
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("becomes a failure of the check itself", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        failures: [
          "pnpm-workspace.yaml exists but cannot be read, so the entry composition check did not run.",
        ],
        scanned: 1,
      });
    });
  });

  describe("a workspace definition carrying no patterns", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "entry-composition-problems-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "catalog: {}\n", "utf8");
      return entryCompositionProblems({ repositoryRoot, config: defaultEntryCompositionConfig });
    });

    it("reads it as an empty workspace layer", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], failures: [], scanned: 1 });
    });
  });
});
