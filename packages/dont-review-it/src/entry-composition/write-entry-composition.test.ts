import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultEntryCompositionConfig } from "./config.ts";
import { entryCompositionProblems } from "./entry-composition-problems.ts";
import { writeEntryComposition } from "./write-entry-composition.ts";

const ROOT_PREFIX = "throttle --timeout 1800 -- spool -- ";

const WORKSPACE_PREFIX = "spool -- ";

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

const UNWRITABLE_REPOSITORY_ROOT = join(tmpdir(), "write-entry-composition-unwritable");

describe("writeEntryComposition", () => {
  describe("a scripts section that does not hold the required entry", () => {
    const it = test
      .extend("writeReportOfTheRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "lint": "vp lint"\n  }\n}\n`,
          "utf8",
        );
        return writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      })
      .extend("manifestTextAfterTheRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "lint": "vp lint"\n  }\n}\n`,
          "utf8",
        );
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return readFileSync(join(repositoryRoot, "package.json"), "utf8");
      })
      .extend("compositionReportAfterTheRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "lint": "vp lint"\n  }\n}\n`,
          "utf8",
        );
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return entryCompositionProblems({
          repositoryRoot,
          config: defaultEntryCompositionConfig,
        });
      });

    it("finishes without a write failure", ({ writeReportOfTheRun }) => {
      expect(writeReportOfTheRun).toStrictEqual({ failures: [] });
    });

    it("is left for the caller to define with an intended command", ({
      manifestTextAfterTheRun,
    }) => {
      expect(manifestTextAfterTheRun).toBe(`{\n  "scripts": {\n    "lint": "vp lint"\n  }\n}\n`);
    });

    it("keeps the missing entry report standing afterwards", ({ compositionReportAfterTheRun }) => {
      expect(compositionReportAfterTheRun).toStrictEqual({
        problems: [
          {
            file: "package.json",
            line: 2,
            message: `The required "guard" script must not be missing. Add "guard" with a value that starts with "${ROOT_PREFIX}".`,
          },
        ],
        failures: [],
        scanned: 1,
      });
    });
  });

  describe("a manifest that carries no scripts section at all", () => {
    const it = test.extend("manifestTextAfterTheRun", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "package.json"), `{\n  "name": "x"\n}\n`, "utf8");
      writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return readFileSync(join(repositoryRoot, "package.json"), "utf8");
    });

    it("is left for the caller to define with an intended command", ({
      manifestTextAfterTheRun,
    }) => {
      expect(manifestTextAfterTheRun).toBe(`{\n  "name": "x"\n}\n`);
    });
  });

  describe("a required entry whose value is not a string", () => {
    const it = test.extend("manifestTextAfterTheRun", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifestText = `{ "scripts": { "guard": false } }`;
      writeFileSync(join(repositoryRoot, "package.json"), manifestText, "utf8");
      writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return readFileSync(join(repositoryRoot, "package.json"), "utf8");
    });

    it("is left for the caller to replace with an intended command", ({
      manifestTextAfterTheRun,
    }) => {
      expect(manifestTextAfterTheRun).toBe(`{ "scripts": { "guard": false } }`);
    });
  });

  describe("a required entry whose wrapper has no command body", () => {
    const it = test.extend("manifestTextAfterTheRun", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifestText = `{ "scripts": { "guard": "spool --" } }`;
      writeFileSync(join(repositoryRoot, "package.json"), manifestText, "utf8");
      writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return readFileSync(join(repositoryRoot, "package.json"), "utf8");
    });

    it("is left for the caller to supply an intended command", ({ manifestTextAfterTheRun }) => {
      expect(manifestTextAfterTheRun).toBe(`{ "scripts": { "guard": "spool --" } }`);
    });
  });

  describe("an entry that carries only part of the wrapper column", () => {
    const it = test.extend("manifestTextAfterTheRun", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "spool -- vp check" } }`,
        "utf8",
      );
      writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return readFileSync(join(repositoryRoot, "package.json"), "utf8");
    });

    it("gains only the missing part of the column", ({ manifestTextAfterTheRun }) => {
      expect(manifestTextAfterTheRun).toBe(`{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`);
    });
  });

  describe("an entry whose column element carries different options", () => {
    const it = test.extend("manifestTextAfterTheRun", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "throttle --timeout 900 -- spool -- vp check" } }`,
        "utf8",
      );
      writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return readFileSync(join(repositoryRoot, "package.json"), "utf8");
    });

    it("loses that element by name and gains the required column", ({
      manifestTextAfterTheRun,
    }) => {
      expect(manifestTextAfterTheRun).toBe(`{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`);
    });
  });

  describe("an entry whose head is not a wrapper but holds the separator", () => {
    const it = test.extend("manifestTextAfterTheRun", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "vp exec tool -- --flag" } }`,
        "utf8",
      );
      writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return readFileSync(join(repositoryRoot, "package.json"), "utf8");
    });

    it("keeps that head and only gains the prefix in front of it", ({
      manifestTextAfterTheRun,
    }) => {
      expect(manifestTextAfterTheRun).toBe(
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp exec tool -- --flag" } }`,
      );
    });
  });

  describe("a non-wrapper command that ends with the separator text", () => {
    const it = test.extend("manifestTextAfterTheRun", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "echo --" } }`,
        "utf8",
      );
      writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return readFileSync(join(repositoryRoot, "package.json"), "utf8");
    });

    it("keeps the command and gains the prefix in front of it", ({ manifestTextAfterTheRun }) => {
      expect(manifestTextAfterTheRun).toBe(`{ "scripts": { "guard": "${ROOT_PREFIX}echo --" } }`);
    });
  });

  describe("an entry whose column is complete but ordered the other way", () => {
    const it = test.extend("manifestTextAfterTheRun", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "spool -- throttle --timeout 1800 -- vp check" } }`,
        "utf8",
      );
      writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return readFileSync(join(repositoryRoot, "package.json"), "utf8");
    });

    it("is normalized to the required order", ({ manifestTextAfterTheRun }) => {
      expect(manifestTextAfterTheRun).toBe(`{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`);
    });
  });

  describe("a repository the first run already repaired", () => {
    const it = test
      .extend("writeReportOfTheSecondRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
        writeFileSync(
          join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "vp test" } }`,
          "utf8",
        );
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      })
      .extend("rootManifestTextAfterTheFirstRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
        writeFileSync(
          join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "vp test" } }`,
          "utf8",
        );
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return readFileSync(join(repositoryRoot, "package.json"), "utf8");
      })
      .extend("rootManifestTextAfterTheSecondRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
        writeFileSync(
          join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "vp test" } }`,
          "utf8",
        );
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return readFileSync(join(repositoryRoot, "package.json"), "utf8");
      })
      .extend("workspaceManifestTextAfterTheFirstRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
        writeFileSync(
          join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "vp test" } }`,
          "utf8",
        );
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return readFileSync(join(repositoryRoot, "packages", "web", "package.json"), "utf8");
      })
      .extend("workspaceManifestTextAfterTheSecondRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
        writeFileSync(
          join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "vp test" } }`,
          "utf8",
        );
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return readFileSync(join(repositoryRoot, "packages", "web", "package.json"), "utf8");
      })
      .extend("compositionReportAfterTheSecondRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
        writeFileSync(
          join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "vp test" } }`,
          "utf8",
        );
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return entryCompositionProblems({
          repositoryRoot,
          config: defaultEntryCompositionConfig,
        });
      });

    it("runs a second time without any failure", ({ writeReportOfTheSecondRun }) => {
      expect(writeReportOfTheSecondRun).toStrictEqual({ failures: [] });
    });

    it("leaves the root manifest carrying the root column after the first run", ({
      rootManifestTextAfterTheFirstRun,
    }) => {
      expect(rootManifestTextAfterTheFirstRun).toBe(
        `{\n  "scripts": {\n    "guard": "${ROOT_PREFIX}vp check"\n  }\n}\n`,
      );
    });

    it("keeps the root manifest exactly as the first run left it", ({
      rootManifestTextAfterTheSecondRun,
    }) => {
      expect(rootManifestTextAfterTheSecondRun).toBe(
        `{\n  "scripts": {\n    "guard": "${ROOT_PREFIX}vp check"\n  }\n}\n`,
      );
    });

    it("leaves the workspace manifest carrying the workspace prefix after the first run", ({
      workspaceManifestTextAfterTheFirstRun,
    }) => {
      expect(workspaceManifestTextAfterTheFirstRun).toBe(
        `{ "scripts": { "test": "${WORKSPACE_PREFIX}vp test" } }`,
      );
    });

    it("keeps the workspace manifest exactly as the first run left it", ({
      workspaceManifestTextAfterTheSecondRun,
    }) => {
      expect(workspaceManifestTextAfterTheSecondRun).toBe(
        `{ "scripts": { "test": "${WORKSPACE_PREFIX}vp test" } }`,
      );
    });

    it("has nothing left to report afterwards", ({ compositionReportAfterTheSecondRun }) => {
      expect(compositionReportAfterTheSecondRun).toStrictEqual({
        problems: [],
        failures: [],
        scanned: 2,
      });
    });
  });

  describe("a workspace manifest that declares the guarded names", () => {
    const it = test.extend("workspaceManifestTextAfterTheRun", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{ "scripts": { "test": "vp test", "check": "${WORKSPACE_PREFIX}vp check" } }`,
        "utf8",
      );
      writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return readFileSync(join(repositoryRoot, "packages", "web", "package.json"), "utf8");
    });

    it("carries the workspace prefix on every declared entry", ({
      workspaceManifestTextAfterTheRun,
    }) => {
      expect(workspaceManifestTextAfterTheRun).toBe(
        `{ "scripts": { "test": "${WORKSPACE_PREFIX}vp test", "check": "${WORKSPACE_PREFIX}vp check" } }`,
      );
    });
  });

  describe("a workspace entry headed by a wrapper of another layer", () => {
    const it = test
      .extend("writeReportOfTheRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
        writeFileSync(
          join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
          "utf8",
        );
        return writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      })
      .extend("workspaceManifestTextAfterTheRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
        writeFileSync(
          join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
          "utf8",
        );
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return readFileSync(join(repositoryRoot, "packages", "web", "package.json"), "utf8");
      })
      .extend("compositionReportAfterTheRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
        writeFileSync(
          join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
          "utf8",
        );
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return entryCompositionProblems({
          repositoryRoot,
          config: defaultEntryCompositionConfig,
        });
      });

    it("does not turn into a failure of the run", ({ writeReportOfTheRun }) => {
      expect(writeReportOfTheRun).toStrictEqual({ failures: [] });
    });

    it("is left untouched", ({ workspaceManifestTextAfterTheRun }) => {
      expect(workspaceManifestTextAfterTheRun).toBe(
        `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
      );
    });

    it("keeps its report standing afterwards", ({ compositionReportAfterTheRun }) => {
      expect(compositionReportAfterTheRun).toStrictEqual({
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

  describe("a repository that already satisfies the composition", () => {
    const it = test
      .extend("writeReportOfTheRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
          "utf8",
        );
        return writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      })
      .extend("manifestTextAfterTheRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        writeFileSync(
          join(repositoryRoot, "package.json"),
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
          "utf8",
        );
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return readFileSync(join(repositoryRoot, "package.json"), "utf8");
      });

    it("runs without any failure", ({ writeReportOfTheRun }) => {
      expect(writeReportOfTheRun).toStrictEqual({ failures: [] });
    });

    it("is left exactly as it stood", ({ manifestTextAfterTheRun }) => {
      expect(manifestTextAfterTheRun).toBe(`{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`);
    });
  });

  describe("a manifest that needs a repair it cannot receive", () => {
    const it = test.extend("writeReportOfTheRun", ({}, { onCleanup }) => {
      rmSync(UNWRITABLE_REPOSITORY_ROOT, { recursive: true, force: true });
      mkdirSync(UNWRITABLE_REPOSITORY_ROOT, { recursive: true });
      onCleanup(() => {
        rmSync(UNWRITABLE_REPOSITORY_ROOT, { recursive: true, force: true });
      });
      writeFileSync(
        join(UNWRITABLE_REPOSITORY_ROOT, "package.json"),
        `{ "scripts": { "guard": "vp check" } }`,
        "utf8",
      );
      chmodSync(join(UNWRITABLE_REPOSITORY_ROOT, "package.json"), 0o444);
      return writeEntryComposition({
        repositoryRoot: UNWRITABLE_REPOSITORY_ROOT,
        config: defaultEntryCompositionConfig,
      });
    });

    it("hands back the write failure instead of pretending the repair happened", ({
      writeReportOfTheRun,
    }) => {
      expect(writeReportOfTheRun).toStrictEqual({
        failures: [
          `package.json could not be rewritten: EACCES: permission denied, open '${join(UNWRITABLE_REPOSITORY_ROOT, "package.json")}'`,
        ],
      });
    });
  });

  describe("a manifest the listing could not read", () => {
    const it = test
      .extend("writeReportOfTheRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        writeFileSync(join(repositoryRoot, "package.json"), "{ oops", "utf8");
        return writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      })
      .extend("manifestTextAfterTheRun", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "write-entry-composition-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        writeFileSync(join(repositoryRoot, "package.json"), "{ oops", "utf8");
        writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return readFileSync(join(repositoryRoot, "package.json"), "utf8");
      });

    it("passes the listing failure through", ({ writeReportOfTheRun }) => {
      expect(writeReportOfTheRun).toStrictEqual({
        failures: [
          "package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
        ],
      });
    });

    it("is left unwritten", ({ manifestTextAfterTheRun }) => {
      expect(manifestTextAfterTheRun).toBe("{ oops");
    });
  });
});
