import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { runStopAiSlop } from "../run-cli.ts";

const GIT_ENVIRONMENT = {
  GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
  GIT_AUTHOR_NAME: "Stop AI Slop",
  GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
  GIT_COMMITTER_NAME: "Stop AI Slop",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  PATH: process.env.PATH,
};

describe("no-removal-verification", () => {
  describe("a head that adds a test file for each source file it deletes", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("deletedSourceTestReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/zeta.ts", "export const zeta = true;\n");
        writeSource("src/alpha.ts", "export const alpha = true;\n");
        commitSnapshot();
        writeSource("src/zeta.test.ts", "");
        writeSource("src/alpha.test.ts", "");
        unlinkSync(join(repositoryRoot, "src/zeta.ts"));
        unlinkSync(join(repositoryRoot, "src/alpha.ts"));
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("names every test file that stands for a deleted source file", ({
      deletedSourceTestReport,
    }) => {
      expect(deletedSourceTestReport).toStrictEqual({
        exitCode: 1,
        out: 'src/alpha.test.ts:1 no-removal-verification: Do not add a test for deleted file "src/alpha.ts"; remove the test or restore the file.\nsrc/zeta.test.ts:1 no-removal-verification: Do not add a test for deleted file "src/zeta.ts"; remove the test or restore the file.\n',
        error: "",
      });
    });
  });

  describe("a head that adds an assertion that a file it deleted does not exist", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("deletedFileAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/legacy.ts", "export const legacy = true;\n");
        commitSnapshot();
        writeSource(
          "src/repository.test.ts",
          'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
        );
        unlinkSync(join(repositoryRoot, "src/legacy.ts"));
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("names the assertion and the file it says is gone", ({ deletedFileAssertionReport }) => {
      expect(deletedFileAssertionReport).toStrictEqual({
        exitCode: 1,
        out: 'src/repository.test.ts:5 no-removal-verification: Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  describe("a file absence assertion written through aliased imports", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("aliasedImportAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/legacy.ts", "export const legacy = true;\n");
        commitSnapshot();
        writeSource(
          "src/repository.test.ts",
          'import { existsSync as pathExists } from "node:fs";\nimport { expect as verify, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  verify(pathExists("src/legacy.ts")).toBe(false);\n});\n',
        );
        unlinkSync(join(repositoryRoot, "src/legacy.ts"));
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("resolves both aliases and names the deleted file", ({ aliasedImportAssertionReport }) => {
      expect(aliasedImportAssertionReport).toStrictEqual({
        exitCode: 1,
        out: 'src/repository.test.ts:5 no-removal-verification: Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  describe("a head that adds assertions that named exports it removed are absent", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("removedExportAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource(
          "src/legacy.ts",
          "export const current = true;\nexport const legacyMode = true;\nexport const secondLegacyMode = true;\n",
        );
        commitSnapshot();
        writeSource("src/legacy.ts", "export const current = true;\n");
        writeSource(
          "src/legacy-api.test.ts",
          'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy modes are gone", () => {\n  expect(legacy).not.toHaveProperty("secondLegacyMode");\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n',
        );
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("names every removed export the assertions speak about", ({
      removedExportAssertionReport,
    }) => {
      expect(removedExportAssertionReport).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "secondLegacyMode" from "src/legacy.ts" remains absent; remove the assertion.\nsrc/legacy-api.test.ts:6 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  describe("a head that adds an assertion for a named re-export it removed", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("removedReExportAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource(
          "src/public.ts",
          'export { current, legacyMode } from "./implementation.ts";\n',
        );
        writeSource(
          "src/implementation.ts",
          "export const current = true;\nexport const legacyMode = true;\n",
        );
        commitSnapshot();
        writeSource("src/public.ts", 'export { current } from "./implementation.ts";\n');
        writeSource(
          "src/public-api.test.ts",
          'import * as publicApi from "./public.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(publicApi).not.toHaveProperty("legacyMode");\n});\n',
        );
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("names the re-exporting module the assertion speaks about", ({
      removedReExportAssertionReport,
    }) => {
      expect(removedReExportAssertionReport).toStrictEqual({
        exitCode: 1,
        out: 'src/public-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/public.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  describe("a head that adds an undefined assertion for a named export it removed", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("undefinedExportAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource(
          "src/legacy.ts",
          "export const current = true;\nexport const legacyMode = true;\n",
        );
        commitSnapshot();
        writeSource("src/legacy.ts", "export const current = true;\n");
        writeSource(
          "src/legacy-api.test.ts",
          'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(legacy.legacyMode).toBeUndefined();\n});\n',
        );
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("reads the undefined assertion as the same claim", ({ undefinedExportAssertionReport }) => {
      expect(undefinedExportAssertionReport).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  describe("a head that adds one more assertion beside an assertion carrying the same locator", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("additionalLocatorAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        const assertionImports =
          'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n';
        const skippedGuard =
          'test.skip("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n';
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource(
          "src/legacy.ts",
          "export const current = true;\nexport const legacyMode = true;\n",
        );
        writeSource("src/legacy-api.test.ts", `${assertionImports}\n${skippedGuard}`);
        commitSnapshot();
        writeSource("src/legacy.ts", "export const current = true;\n");
        writeSource(
          "src/legacy-api.test.ts",
          `${assertionImports}\ntest("legacy mode is gone", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n\n${skippedGuard}`,
        );
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("names the assertion the head added", ({ additionalLocatorAssertionReport }) => {
      expect(additionalLocatorAssertionReport).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  describe("an assertion whose import the head moved onto the module it removed the export from", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("retargetedImportAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        const guardingSpec =
          'import * as legacy from "./other.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n';
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource(
          "src/legacy.ts",
          "export const current = true;\nexport const legacyMode = true;\n",
        );
        writeSource("src/other.ts", "export const current = true;\n");
        writeSource("src/legacy-api.test.ts", guardingSpec);
        commitSnapshot();
        writeSource("src/legacy.ts", "export const current = true;\n");
        writeSource("src/legacy-api.test.ts", guardingSpec.replace("./other.ts", "./legacy.ts"));
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("names the module the import now points at", ({ retargetedImportAssertionReport }) => {
      expect(retargetedImportAssertionReport).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  describe("a head that deletes a file without adding any absence check", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("deletionWithoutAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/legacy.ts", "export const legacy = true;\n");
        commitSnapshot();
        writeSource("src/current.ts", "export const current = true;\n");
        unlinkSync(join(repositoryRoot, "src/legacy.ts"));
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("lets the deletion through", ({ deletionWithoutAssertionReport }) => {
      expect(deletionWithoutAssertionReport).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  describe("an absence check the head adds without deleting anything it names", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("assertionWithoutDeletionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/current.ts", "export const current = true;\n");
        commitSnapshot();
        writeSource(
          "src/repository.test.ts",
          'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
        );
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("lets the assertion through", ({ assertionWithoutDeletionReport }) => {
      expect(assertionWithoutDeletionReport).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  describe("an assertion that a deleted file still exists", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("positiveExistenceAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/legacy.ts", "export const legacy = true;\n");
        commitSnapshot();
        writeSource(
          "src/repository.test.ts",
          'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy exists", () => {\n  expect(existsSync("src/legacy.ts")).toBe(true);\n});\n',
        );
        unlinkSync(join(repositoryRoot, "src/legacy.ts"));
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("lets the positive assertion through", ({ positiveExistenceAssertionReport }) => {
      expect(positiveExistenceAssertionReport).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  describe("an absence assertion the base already carried", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("existingAbsenceAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource(
          "src/legacy.ts",
          "export const current = true;\nexport const legacyMode = true;\n",
        );
        writeSource(
          "src/legacy-api.test.ts",
          'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n',
        );
        commitSnapshot();
        writeSource("src/legacy.ts", "export const current = true;\n");
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("lets the assertion the head left alone through", ({ existingAbsenceAssertionReport }) => {
      expect(existingAbsenceAssertionReport).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  describe("an assertion naming an export of a module the head did not touch", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("otherModuleExportAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource(
          "src/removed-from.ts",
          "export const current = true;\nexport const legacyMode = true;\n",
        );
        writeSource("src/other.ts", "export const legacyMode = true;\n");
        commitSnapshot();
        writeSource("src/removed-from.ts", "export const current = true;\n");
        writeSource(
          "src/other-api.test.ts",
          'import * as other from "./other.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("other module", () => {\n  expect(other).not.toHaveProperty("legacyMode");\n});\n',
        );
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("keeps the two modules apart", ({ otherModuleExportAssertionReport }) => {
      expect(otherModuleExportAssertionReport).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  describe("a module path and an export name that both carry the locator separator", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("locatorSeparatorAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/a.ts", 'const value = true;\nexport { value as "x.ts#foo" };\n');
        writeSource("src/a.ts#x.ts", "export const foo = true;\n");
        commitSnapshot();
        writeSource("src/a.ts", "export const current = true;\n");
        writeSource(
          "src/collision.test.ts",
          'import * as other from "./a.ts#x.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("other module", () => {\n  expect(other).not.toHaveProperty("foo");\n});\n',
        );
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("keeps the two locators apart", ({ locatorSeparatorAssertionReport }) => {
      expect(locatorSeparatorAssertionReport).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  describe("assertions naming a type export and a default export the head dropped", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("nonValueExportAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource(
          "src/legacy.ts",
          "export const current = true;\nexport type Legacy = string;\nexport default true;\n",
        );
        commitSnapshot();
        writeSource("src/legacy.ts", "export const current = true;\n");
        writeSource(
          "src/legacy-api.test.ts",
          'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("non-value exports", () => {\n  expect(legacy).not.toHaveProperty("Legacy");\n  expect(legacy).not.toHaveProperty("default");\n});\n',
        );
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("counts neither of them as a removed value export", ({ nonValueExportAssertionReport }) => {
      expect(nonValueExportAssertionReport).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  describe("assertions naming a default alias and a default re-export the head dropped", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("defaultExportAliasAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/alias.ts", 'const value = true;\nexport { value as "default" };\n');
        writeSource(
          "src/re-export.ts",
          'export { value as default } from "./implementation.ts";\n',
        );
        writeSource("src/implementation.ts", "export const value = true;\n");
        commitSnapshot();
        writeSource("src/alias.ts", "export const current = true;\n");
        writeSource("src/re-export.ts", "export const current = true;\n");
        writeSource(
          "src/default-api.test.ts",
          'import * as alias from "./alias.ts";\nimport * as reExport from "./re-export.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("default exports", () => {\n  expect(alias).not.toHaveProperty("default");\n  expect(reExport).not.toHaveProperty("default");\n});\n',
        );
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("counts neither of them as a removed named export", ({
      defaultExportAliasAssertionReport,
    }) => {
      expect(defaultExportAliasAssertionReport).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  describe("an absence assertion naming the old path of a file the head renamed", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("renamedFileAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        const renamedSource = "export const legacy = true;\n";
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource("src/legacy.ts", renamedSource);
        commitSnapshot();
        writeSource("src/current.ts", renamedSource);
        writeSource(
          "src/repository.test.ts",
          'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy path is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
        );
        unlinkSync(join(repositoryRoot, "src/legacy.ts"));
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("reads the rename as a move rather than a deletion", ({ renamedFileAssertionReport }) => {
      expect(renamedFileAssertionReport).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  describe("an assertion reaching the removed export through a computed property", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const createdRoot = mkdtempSync(join(tmpdir(), "no-removal-verification-"));
        onCleanup(() => {
          rmSync(createdRoot, { recursive: true, force: true });
        });
        return createdRoot;
      })
      .extend("computedPropertyAssertionReport", async ({ repositoryRoot }) => {
        const runGit = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: { ...GIT_ENVIRONMENT, HOME: repositoryRoot },
          });
        const writeSource = (relativePath: string, sourceText: string): void => {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, sourceText);
        };
        const commitSnapshot = (): void => {
          runGit(["add", "--all"]);
          runGit(["commit", "--quiet", "--message", "snapshot"]);
        };
        runGit(["init", "--quiet", "--initial-branch=main"]);
        writeSource(
          "src/legacy.ts",
          "export const current = true;\nexport const legacyMode = true;\n",
        );
        commitSnapshot();
        writeSource("src/legacy.ts", "export const current = true;\n");
        writeSource(
          "src/legacy-api.test.ts",
          'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(legacy["legacyMode"]).toBeUndefined();\n});\n',
        );
        commitSnapshot();
        return runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      });

    it("reads only the static member as the claim", ({ computedPropertyAssertionReport }) => {
      expect(computedPropertyAssertionReport).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });
});
