import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCommand } from "citty";
import { describe, expect } from "vite-plus/test";

import { dontReviewItCommand } from "./dont-review-it-command.ts";
import { RETIRED_ANNOTATION_TAGS } from "./lint/oxlint/lib/canonical-values/annotation.ts";
import { standardIoTest } from "./vitest/standard-io-test.ts";

const CANONICAL_VALUES_TAG = "@canonical-values";

const REACT_CATALOG_SOURCE = "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n";

const REACT_CATALOG_REFERENCE = `{"dependencies": {"react": "catalog:"}}`;

const REACT_DIRECT_REFERENCE = `{"dependencies": {"react": "^18.0.0"}}`;

describe("dontReviewItCommand", () => {
  describe("a repository whose annotation names the concept it declares", () => {
    const it = standardIoTest
      .extend("theExitCodeOfANamedAnnotation", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/order.ts"),
          `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--repository-root", root],
        });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theStandardOutputOfANamedAnnotation", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/order.ts"),
          `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--repository-root", root],
        });
        process.exitCode = 0;
        return stdout.text();
      })
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForANamedAnnotation",
        async ({ stderr }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          mkdirSync(join(root, "src"), { recursive: true });
          writeFileSync(
            join(root, "src/order.ts"),
            `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
            "utf8",
          );
          await runCommand(dontReviewItCommand, {
            rawArgs: ["check", "--repository-root", root],
          });
          process.exitCode = 0;
          return stderr.text().includes("entry-composition");
        },
      );

    it("exits zero", ({ theExitCodeOfANamedAnnotation }) => {
      expect(theExitCodeOfANamedAnnotation).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfANamedAnnotation }) => {
      expect(theStandardOutputOfANamedAnnotation).toBe("");
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForANamedAnnotation,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForANamedAnnotation).toBe(true);
    });
  });

  describe("a check given no repository root", () => {
    const it = standardIoTest
      .extend("theExitCodeWithoutARepositoryRoot", async ({}, { onCleanup }) => {
        const workingDirectory = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        const previousWorkingDirectory = process.cwd();
        onCleanup(() => {
          process.chdir(previousWorkingDirectory);
          rmSync(workingDirectory, { recursive: true, force: true });
        });
        writeFileSync(join(workingDirectory, "package.json"), "{}", "utf8");
        process.chdir(workingDirectory);
        await runCommand(dontReviewItCommand, { rawArgs: ["check"] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theMissingGuardEntryIsNamedOnStandardOutput", async ({ stdout }, { onCleanup }) => {
        const workingDirectory = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        const previousWorkingDirectory = process.cwd();
        onCleanup(() => {
          process.chdir(previousWorkingDirectory);
          rmSync(workingDirectory, { recursive: true, force: true });
        });
        writeFileSync(join(workingDirectory, "package.json"), "{}", "utf8");
        process.chdir(workingDirectory);
        await runCommand(dontReviewItCommand, { rawArgs: ["check"] });
        process.exitCode = 0;
        return stdout.text().includes('required "guard" entry must not be missing');
      })
      .extend("theWorkspaceOfTheWorkingDirectoryIsScanned", async ({ stderr }, { onCleanup }) => {
        const workingDirectory = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        const previousWorkingDirectory = process.cwd();
        onCleanup(() => {
          process.chdir(previousWorkingDirectory);
          rmSync(workingDirectory, { recursive: true, force: true });
        });
        writeFileSync(join(workingDirectory, "package.json"), "{}", "utf8");
        process.chdir(workingDirectory);
        await runCommand(dontReviewItCommand, { rawArgs: ["check"] });
        process.exitCode = 0;
        return stderr.text().includes("canonical-values");
      })
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorWithoutARepositoryRoot",
        async ({ stderr }, { onCleanup }) => {
          const workingDirectory = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          const previousWorkingDirectory = process.cwd();
          onCleanup(() => {
            process.chdir(previousWorkingDirectory);
            rmSync(workingDirectory, { recursive: true, force: true });
          });
          writeFileSync(join(workingDirectory, "package.json"), "{}", "utf8");
          process.chdir(workingDirectory);
          await runCommand(dontReviewItCommand, { rawArgs: ["check"] });
          process.exitCode = 0;
          return stderr.text().includes("entry-composition");
        },
      );

    it("exits one", ({ theExitCodeWithoutARepositoryRoot }) => {
      expect(theExitCodeWithoutARepositoryRoot).toBe(1);
    });

    it("names the guard entry the working directory is missing on standard output", ({
      theMissingGuardEntryIsNamedOnStandardOutput,
    }) => {
      expect(theMissingGuardEntryIsNamedOnStandardOutput).toBe(true);
    });

    it("scans the workspace the working directory holds", ({
      theWorkspaceOfTheWorkingDirectoryIsScanned,
    }) => {
      expect(theWorkspaceOfTheWorkingDirectoryIsScanned).toBe(true);
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorWithoutARepositoryRoot,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorWithoutARepositoryRoot).toBe(true);
    });
  });

  describe("an annotation that names no concept in the working directory", () => {
    const it = standardIoTest
      .extend("theExitCodeOfAnAnnotationInTheWorkingDirectory", async ({}, { onCleanup }) => {
        const workingDirectory = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        const previousWorkingDirectory = process.cwd();
        onCleanup(() => {
          process.chdir(previousWorkingDirectory);
          rmSync(workingDirectory, { recursive: true, force: true });
        });
        mkdirSync(join(workingDirectory, "src"), { recursive: true });
        writeFileSync(
          join(workingDirectory, "src/order.ts"),
          `/** ${CANONICAL_VALUES_TAG} */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
          "utf8",
        );
        process.chdir(workingDirectory);
        await runCommand(dontReviewItCommand, { rawArgs: ["check"] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend(
        "theDeclarationSiteInTheWorkingDirectoryIsNamedOnStandardOutput",
        async ({ stdout }, { onCleanup }) => {
          const workingDirectory = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          const previousWorkingDirectory = process.cwd();
          onCleanup(() => {
            process.chdir(previousWorkingDirectory);
            rmSync(workingDirectory, { recursive: true, force: true });
          });
          mkdirSync(join(workingDirectory, "src"), { recursive: true });
          writeFileSync(
            join(workingDirectory, "src/order.ts"),
            `/** ${CANONICAL_VALUES_TAG} */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
            "utf8",
          );
          process.chdir(workingDirectory);
          await runCommand(dontReviewItCommand, { rawArgs: ["check"] });
          process.exitCode = 0;
          return stdout.text().includes("src/order.ts:1");
        },
      )
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForTheWorkingDirectory",
        async ({ stderr }, { onCleanup }) => {
          const workingDirectory = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          const previousWorkingDirectory = process.cwd();
          onCleanup(() => {
            process.chdir(previousWorkingDirectory);
            rmSync(workingDirectory, { recursive: true, force: true });
          });
          mkdirSync(join(workingDirectory, "src"), { recursive: true });
          writeFileSync(
            join(workingDirectory, "src/order.ts"),
            `/** ${CANONICAL_VALUES_TAG} */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
            "utf8",
          );
          process.chdir(workingDirectory);
          await runCommand(dontReviewItCommand, { rawArgs: ["check"] });
          process.exitCode = 0;
          return stderr.text().includes("entry-composition");
        },
      );

    it("fails the check", ({ theExitCodeOfAnAnnotationInTheWorkingDirectory }) => {
      expect(theExitCodeOfAnAnnotationInTheWorkingDirectory).toBe(1);
    });

    it("names the declaration site the working directory holds", ({
      theDeclarationSiteInTheWorkingDirectoryIsNamedOnStandardOutput,
    }) => {
      expect(theDeclarationSiteInTheWorkingDirectoryIsNamedOnStandardOutput).toBe(true);
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForTheWorkingDirectory,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForTheWorkingDirectory).toBe(true);
    });
  });

  describe("a repository root glued to the flag", () => {
    const it = standardIoTest
      .extend("theExitCodeOfAGluedRepositoryRoot", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/order.ts"),
          `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", `--repository-root=${root}`] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theStandardOutputOfAGluedRepositoryRoot", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/order.ts"),
          `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", `--repository-root=${root}`] });
        process.exitCode = 0;
        return stdout.text();
      })
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForAGluedRepositoryRoot",
        async ({ stderr }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          mkdirSync(join(root, "src"), { recursive: true });
          writeFileSync(
            join(root, "src/order.ts"),
            `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
            "utf8",
          );
          await runCommand(dontReviewItCommand, {
            rawArgs: ["check", `--repository-root=${root}`],
          });
          process.exitCode = 0;
          return stderr.text().includes("entry-composition");
        },
      );

    it("exits zero", ({ theExitCodeOfAGluedRepositoryRoot }) => {
      expect(theExitCodeOfAGluedRepositoryRoot).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfAGluedRepositoryRoot }) => {
      expect(theStandardOutputOfAGluedRepositoryRoot).toBe("");
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForAGluedRepositoryRoot,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForAGluedRepositoryRoot).toBe(true);
    });
  });

  describe("a workspace whose packages disagree on a dependency version", () => {
    const it = standardIoTest
      .extend("theExitCodeOfAVersionDisagreement", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
        mkdirSync(join(root, "packages/web"), { recursive: true });
        mkdirSync(join(root, "packages/site"), { recursive: true });
        writeFileSync(
          join(root, "packages/web/package.json"),
          `{"devDependencies": {"typescript": "^5.0.0"}}`,
          "utf8",
        );
        writeFileSync(
          join(root, "packages/site/package.json"),
          `{"devDependencies": {"typescript": "^5.5.0"}}`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theStandardOutputOfAVersionDisagreement", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
        mkdirSync(join(root, "packages/web"), { recursive: true });
        mkdirSync(join(root, "packages/site"), { recursive: true });
        writeFileSync(
          join(root, "packages/web/package.json"),
          `{"devDependencies": {"typescript": "^5.0.0"}}`,
          "utf8",
        );
        writeFileSync(
          join(root, "packages/site/package.json"),
          `{"devDependencies": {"typescript": "^5.5.0"}}`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text();
      })
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForAVersionDisagreement",
        async ({ stderr }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
          mkdirSync(join(root, "packages/web"), { recursive: true });
          mkdirSync(join(root, "packages/site"), { recursive: true });
          writeFileSync(
            join(root, "packages/web/package.json"),
            `{"devDependencies": {"typescript": "^5.0.0"}}`,
            "utf8",
          );
          writeFileSync(
            join(root, "packages/site/package.json"),
            `{"devDependencies": {"typescript": "^5.5.0"}}`,
            "utf8",
          );
          await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
          process.exitCode = 0;
          return stderr.text().includes("entry-composition");
        },
      );

    it("exits one", ({ theExitCodeOfAVersionDisagreement }) => {
      expect(theExitCodeOfAVersionDisagreement).toBe(1);
    });

    it("prints the disagreement as a problem", ({ theStandardOutputOfAVersionDisagreement }) => {
      expect(theStandardOutputOfAVersionDisagreement).toBe(
        "pnpm-workspace.yaml typescript is pinned to different specifiers: packages/site/package.json pins ^5.5.0, packages/web/package.json pins ^5.0.0. Choose the intended version, add it to the catalog, and reference it with catalog: from every listed manifest.\n",
      );
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForAVersionDisagreement,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForAVersionDisagreement).toBe(true);
    });
  });

  describe("a catalog reference beside a direct pin of a different version", () => {
    const it = standardIoTest
      .extend("theExitCodeOfACatalogVersionDisagreement", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "pnpm-workspace.yaml"), REACT_CATALOG_SOURCE, "utf8");
        mkdirSync(join(root, "packages/web"), { recursive: true });
        mkdirSync(join(root, "packages/legacy"), { recursive: true });
        writeFileSync(join(root, "packages/web/package.json"), REACT_CATALOG_REFERENCE, "utf8");
        writeFileSync(join(root, "packages/legacy/package.json"), REACT_DIRECT_REFERENCE, "utf8");
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend(
        "theStandardOutputOfACatalogVersionDisagreement",
        async ({ stdout }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          writeFileSync(join(root, "pnpm-workspace.yaml"), REACT_CATALOG_SOURCE, "utf8");
          mkdirSync(join(root, "packages/web"), { recursive: true });
          mkdirSync(join(root, "packages/legacy"), { recursive: true });
          writeFileSync(join(root, "packages/web/package.json"), REACT_CATALOG_REFERENCE, "utf8");
          writeFileSync(join(root, "packages/legacy/package.json"), REACT_DIRECT_REFERENCE, "utf8");
          await runCommand(dontReviewItCommand, {
            rawArgs: ["check", "--repository-root", root],
          });
          process.exitCode = 0;
          return stdout.text();
        },
      );

    it("exits one", ({ theExitCodeOfACatalogVersionDisagreement }) => {
      expect(theExitCodeOfACatalogVersionDisagreement).toBe(1);
    });

    it("prints only the version disagreement", ({
      theStandardOutputOfACatalogVersionDisagreement,
    }) => {
      expect(theStandardOutputOfACatalogVersionDisagreement).toBe(
        "packages/legacy/package.json react is pinned to ^18.0.0 here while the catalog pins ^19.0.0. Choose the intended version, keep it in one catalog entry, and replace this manifest's specifier with a reference to that entry.\n",
      );
    });
  });

  describe("an annotation that names no concept", () => {
    const it = standardIoTest
      .extend("theExitCodeOfAnUnnamedAnnotation", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/order.ts"),
          `/** ${CANONICAL_VALUES_TAG} */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theStandardOutputOfAnUnnamedAnnotation", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/order.ts"),
          `/** ${CANONICAL_VALUES_TAG} */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text();
      })
      .extend(
        "theDeclarationSiteOfAnUnnamedAnnotationIsNamedOnStandardOutput",
        async ({ stdout }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          mkdirSync(join(root, "src"), { recursive: true });
          writeFileSync(
            join(root, "src/order.ts"),
            `/** ${CANONICAL_VALUES_TAG} */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
            "utf8",
          );
          await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
          process.exitCode = 0;
          return stdout.text().includes("src/order.ts:1");
        },
      )
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForAnUnnamedAnnotation",
        async ({ stderr }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          mkdirSync(join(root, "src"), { recursive: true });
          writeFileSync(
            join(root, "src/order.ts"),
            `/** ${CANONICAL_VALUES_TAG} */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
            "utf8",
          );
          await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
          process.exitCode = 0;
          return stderr.text().includes("entry-composition");
        },
      );

    it("exits one", ({ theExitCodeOfAnUnnamedAnnotation }) => {
      expect(theExitCodeOfAnUnnamedAnnotation).toBe(1);
    });

    it("records the whole report on standard output", ({
      theStandardOutputOfAnUnnamedAnnotation,
    }) => {
      expect(theStandardOutputOfAnUnnamedAnnotation).toMatchInlineSnapshot(`
        "src/order.ts:1 A canonical values annotation must name the concept it declares. Write the tag followed by a concept id built from lowercase words joined by "-" or ".".
        "
      `);
    });

    it("names the declaration site on standard output", ({
      theDeclarationSiteOfAnUnnamedAnnotationIsNamedOnStandardOutput,
    }) => {
      expect(theDeclarationSiteOfAnUnnamedAnnotationIsNamedOnStandardOutput).toBe(true);
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForAnUnnamedAnnotation,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForAnUnnamedAnnotation).toBe(true);
    });
  });

  describe("a broken annotation that sits in a dot directory", () => {
    const it = standardIoTest.extend(
      "theDeclarationSiteInADotDirectoryIsNamedOnStandardOutput",
      async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, ".config"), { recursive: true });
        writeFileSync(
          join(root, ".config/broken.ts"),
          `/** ${CANONICAL_VALUES_TAG} NOT VALID ID */\nexport const BROKEN_STATUSES = ["draft"] as const;\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text().includes(".config/broken.ts:1");
      },
    );

    it("names the declaration site the scan reached", ({
      theDeclarationSiteInADotDirectoryIsNamedOnStandardOutput,
    }) => {
      expect(theDeclarationSiteInADotDirectoryIsNamedOnStandardOutput).toBe(true);
    });
  });

  describe("a retired annotation tag left in a JavaScript file", () => {
    const it = standardIoTest
      .extend("theExitCodeOfARetiredAnnotationTag", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "scripts"), { recursive: true });
        writeFileSync(
          join(root, "scripts/legacy.mjs"),
          `/** ${RETIRED_ANNOTATION_TAGS[0]} */\nexport const LEGACY_STATUSES = ["draft"];\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend(
        "theDeclarationSiteOfARetiredAnnotationTagIsNamedOnStandardOutput",
        async ({ stdout }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          mkdirSync(join(root, "scripts"), { recursive: true });
          writeFileSync(
            join(root, "scripts/legacy.mjs"),
            `/** ${RETIRED_ANNOTATION_TAGS[0]} */\nexport const LEGACY_STATUSES = ["draft"];\n`,
            "utf8",
          );
          await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
          process.exitCode = 0;
          return stdout.text().includes("scripts/legacy.mjs:1");
        },
      )
      .extend("theRetiredTagIsNamedOnStandardOutput", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "scripts"), { recursive: true });
        writeFileSync(
          join(root, "scripts/legacy.mjs"),
          `/** ${RETIRED_ANNOTATION_TAGS[0]} */\nexport const LEGACY_STATUSES = ["draft"];\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text().includes(RETIRED_ANNOTATION_TAGS[0] ?? "");
      });

    it("exits one", ({ theExitCodeOfARetiredAnnotationTag }) => {
      expect(theExitCodeOfARetiredAnnotationTag).toBe(1);
    });

    it("names the declaration site on standard output", ({
      theDeclarationSiteOfARetiredAnnotationTagIsNamedOnStandardOutput,
    }) => {
      expect(theDeclarationSiteOfARetiredAnnotationTagIsNamedOnStandardOutput).toBe(true);
    });

    it("names the retired tag on standard output", ({ theRetiredTagIsNamedOnStandardOutput }) => {
      expect(theRetiredTagIsNamedOnStandardOutput).toBe(true);
    });
  });

  describe("a concept a test file repeats", () => {
    const it = standardIoTest
      .extend("theExitCodeOfAConceptATestFileRepeats", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/order.test.ts"),
          'const FIXTURE_STATUSES = ["draft"] as const;\n',
          "utf8",
        );
        writeFileSync(
          join(root, "src/order.ts"),
          `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theStandardOutputOfAConceptATestFileRepeats", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/order.test.ts"),
          'const FIXTURE_STATUSES = ["draft"] as const;\n',
          "utf8",
        );
        writeFileSync(
          join(root, "src/order.ts"),
          `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text();
      })
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForAConceptATestFileRepeats",
        async ({ stderr }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          mkdirSync(join(root, "src"), { recursive: true });
          writeFileSync(
            join(root, "src/order.test.ts"),
            'const FIXTURE_STATUSES = ["draft"] as const;\n',
            "utf8",
          );
          writeFileSync(
            join(root, "src/order.ts"),
            `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
            "utf8",
          );
          await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
          process.exitCode = 0;
          return stderr.text().includes("entry-composition");
        },
      );

    it("is never reported against the declaration that owns it", ({
      theExitCodeOfAConceptATestFileRepeats,
    }) => {
      expect(theExitCodeOfAConceptATestFileRepeats).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfAConceptATestFileRepeats }) => {
      expect(theStandardOutputOfAConceptATestFileRepeats).toBe("");
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForAConceptATestFileRepeats,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForAConceptATestFileRepeats).toBe(true);
    });
  });

  describe("a value set that more than one concept declares", () => {
    const it = standardIoTest
      .extend("theExitCodeOfASharedValueSet", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/article.ts"),
          `/** ${CANONICAL_VALUES_TAG} article.status */\nexport const ARTICLE_STATUSES = ["published", "draft"] as const;\n`,
          "utf8",
        );
        writeFileSync(
          join(root, "src/order.ts"),
          `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theArticleConceptIsNamedOnStandardOutput", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/article.ts"),
          `/** ${CANONICAL_VALUES_TAG} article.status */\nexport const ARTICLE_STATUSES = ["published", "draft"] as const;\n`,
          "utf8",
        );
        writeFileSync(
          join(root, "src/order.ts"),
          `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text().includes("article.status");
      })
      .extend("theOrderConceptIsNamedOnStandardOutput", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/article.ts"),
          `/** ${CANONICAL_VALUES_TAG} article.status */\nexport const ARTICLE_STATUSES = ["published", "draft"] as const;\n`,
          "utf8",
        );
        writeFileSync(
          join(root, "src/order.ts"),
          `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text().includes("order.status");
      });

    it("is warned about without failing the check", ({ theExitCodeOfASharedValueSet }) => {
      expect(theExitCodeOfASharedValueSet).toBe(0);
    });

    it("names the first concept that declares it", ({
      theArticleConceptIsNamedOnStandardOutput,
    }) => {
      expect(theArticleConceptIsNamedOnStandardOutput).toBe(true);
    });

    it("names the second concept that declares it", ({
      theOrderConceptIsNamedOnStandardOutput,
    }) => {
      expect(theOrderConceptIsNamedOnStandardOutput).toBe(true);
    });
  });

  describe("an unknown command", () => {
    const it = standardIoTest.extend("theRejectionOfAnUnknownCommand", async () => {
      try {
        await runCommand(dontReviewItCommand, { rawArgs: ["publish"] });
        throw new Error("the unknown command was accepted");
      } catch (rejection) {
        return rejection instanceof Error ? rejection.message : String(rejection);
      } finally {
        process.exitCode = 0;
      }
    });

    it("is rejected by name", ({ theRejectionOfAnUnknownCommand }) => {
      expect(theRejectionOfAnUnknownCommand).toMatchInlineSnapshot(`"Unknown command publish"`);
    });
  });

  describe("no command at all", () => {
    const it = standardIoTest.extend("theRejectionOfNoCommand", async () => {
      try {
        await runCommand(dontReviewItCommand, { rawArgs: [] });
        throw new Error("no command at all was accepted");
      } catch (rejection) {
        return rejection instanceof Error ? rejection.message : String(rejection);
      } finally {
        process.exitCode = 0;
      }
    });

    it("is rejected instead of running anything", ({ theRejectionOfNoCommand }) => {
      expect(theRejectionOfNoCommand).toMatchInlineSnapshot(`"No command specified."`);
    });
  });

  describe("a repository root that is not a directory", () => {
    const it = standardIoTest
      .extend("theExitCodeOfAMissingRepositoryRoot", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        await runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--repository-root", join(root, "missing")],
        });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theStandardOutputOfAMissingRepositoryRoot", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        await runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--repository-root", join(root, "missing")],
        });
        process.exitCode = 0;
        return stdout.text();
      })
      .extend(
        "theMissingRepositoryRootIsNamedOnStandardError",
        async ({ stderr }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          await runCommand(dontReviewItCommand, {
            rawArgs: ["check", "--repository-root", join(root, "missing")],
          });
          process.exitCode = 0;
          return stderr.text().includes("missing");
        },
      );

    it("exits two instead of scanning nothing", ({ theExitCodeOfAMissingRepositoryRoot }) => {
      expect(theExitCodeOfAMissingRepositoryRoot).toBe(2);
    });

    it("stays silent on standard output", ({ theStandardOutputOfAMissingRepositoryRoot }) => {
      expect(theStandardOutputOfAMissingRepositoryRoot).toBe("");
    });

    it("names the root it could not read on standard error", ({
      theMissingRepositoryRootIsNamedOnStandardError,
    }) => {
      expect(theMissingRepositoryRootIsNamedOnStandardError).toBe(true);
    });
  });

  describe("an unknown option", () => {
    const it = standardIoTest
      .extend("theExitCodeOfAnUnknownOption", async () => {
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repo-root", "."] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theStandardOutputOfAnUnknownOption", async ({ stdout }) => {
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repo-root", "."] });
        process.exitCode = 0;
        return stdout.text();
      })
      .extend("theStandardErrorOfAnUnknownOption", async ({ stderr }) => {
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repo-root", "."] });
        process.exitCode = 0;
        return stderr.text();
      });

    it("exits two instead of falling back to a default", ({ theExitCodeOfAnUnknownOption }) => {
      expect(theExitCodeOfAnUnknownOption).toBe(2);
    });

    it("stays silent on standard output", ({ theStandardOutputOfAnUnknownOption }) => {
      expect(theStandardOutputOfAnUnknownOption).toBe("");
    });

    it("records the whole reason on standard error", ({ theStandardErrorOfAnUnknownOption }) => {
      expect(theStandardErrorOfAnUnknownOption).toMatchInlineSnapshot(`
        "Unknown option --repo-root. Run --help for usage.
        "
      `);
    });
  });

  describe("a repository where no body is spelled twice", () => {
    const it = standardIoTest
      .extend("theExitCodeOfDistinctBodies", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/twice.ts"),
          "export const twice = (value: number): number => value * 2;\n",
          "utf8",
        );
        writeFileSync(
          join(root, "src/thrice.ts"),
          "export const thrice = (value: number): number => value * 3;\n",
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theStandardOutputOfDistinctBodies", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/twice.ts"),
          "export const twice = (value: number): number => value * 2;\n",
          "utf8",
        );
        writeFileSync(
          join(root, "src/thrice.ts"),
          "export const thrice = (value: number): number => value * 3;\n",
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text();
      })
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForDistinctBodies",
        async ({ stderr }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          mkdirSync(join(root, "src"), { recursive: true });
          writeFileSync(
            join(root, "src/twice.ts"),
            "export const twice = (value: number): number => value * 2;\n",
            "utf8",
          );
          writeFileSync(
            join(root, "src/thrice.ts"),
            "export const thrice = (value: number): number => value * 3;\n",
            "utf8",
          );
          await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
          process.exitCode = 0;
          return stderr.text().includes("entry-composition");
        },
      );

    it("exits zero", ({ theExitCodeOfDistinctBodies }) => {
      expect(theExitCodeOfDistinctBodies).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfDistinctBodies }) => {
      expect(theStandardOutputOfDistinctBodies).toBe("");
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForDistinctBodies,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForDistinctBodies).toBe(true);
    });
  });

  describe("a body spelled twice", () => {
    const it = standardIoTest
      .extend("theExitCodeOfABodySpelledTwice", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/twice.ts"),
          "export const twice = (value: number): number => value * 2;\n",
          "utf8",
        );
        writeFileSync(
          join(root, "src/doubled.ts"),
          "export const doubled = (value: number): number => value * 2;\n",
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theDoubledSiteIsNamedOnStandardOutput", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/twice.ts"),
          "export const twice = (value: number): number => value * 2;\n",
          "utf8",
        );
        writeFileSync(
          join(root, "src/doubled.ts"),
          "export const doubled = (value: number): number => value * 2;\n",
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text().includes("src/doubled.ts:1 (doubled)");
      })
      .extend("theTwiceSiteIsNamedOnStandardOutput", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/twice.ts"),
          "export const twice = (value: number): number => value * 2;\n",
          "utf8",
        );
        writeFileSync(
          join(root, "src/doubled.ts"),
          "export const doubled = (value: number): number => value * 2;\n",
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text().includes("src/twice.ts:1 (twice)");
      });

    it("fails the check", ({ theExitCodeOfABodySpelledTwice }) => {
      expect(theExitCodeOfABodySpelledTwice).toBe(1);
    });

    it("names the site that repeated the body", ({ theDoubledSiteIsNamedOnStandardOutput }) => {
      expect(theDoubledSiteIsNamedOnStandardOutput).toBe(true);
    });

    it("names the site that already held the body", ({ theTwiceSiteIsNamedOnStandardOutput }) => {
      expect(theTwiceSiteIsNamedOnStandardOutput).toBe(true);
    });
  });

  describe("a body a test file repeats", () => {
    const it = standardIoTest
      .extend("theExitCodeOfABodyATestFileRepeats", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/twice.ts"),
          "export const twice = (value: number): number => value * 2;\n",
          "utf8",
        );
        writeFileSync(
          join(root, "src/twice.test.ts"),
          "export const doubled = (value: number): number => value * 2;\n",
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theStandardOutputOfABodyATestFileRepeats", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(
          join(root, "src/twice.ts"),
          "export const twice = (value: number): number => value * 2;\n",
          "utf8",
        );
        writeFileSync(
          join(root, "src/twice.test.ts"),
          "export const doubled = (value: number): number => value * 2;\n",
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text();
      });

    it("is left out of the body scan", ({ theExitCodeOfABodyATestFileRepeats }) => {
      expect(theExitCodeOfABodyATestFileRepeats).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfABodyATestFileRepeats }) => {
      expect(theStandardOutputOfABodyATestFileRepeats).toBe("");
    });
  });

  describe("check --write on entries it may repair", () => {
    const it = standardIoTest
      .extend("theExitCodeOfARepairedEntryComposition", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(
          join(root, "package.json"),
          `{ "scripts": { "guard": "vp run guard:all", "guard:all": "vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2" } }`,
          "utf8",
        );
        writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
        mkdirSync(join(root, "packages/web"), { recursive: true });
        writeFileSync(
          join(root, "packages/web/package.json"),
          `{ "scripts": { "test": "vp test" } }`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--write", "--repository-root", root],
        });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theStandardOutputOfARepairedEntryComposition", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(
          join(root, "package.json"),
          `{ "scripts": { "guard": "vp run guard:all", "guard:all": "vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2" } }`,
          "utf8",
        );
        writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
        mkdirSync(join(root, "packages/web"), { recursive: true });
        writeFileSync(
          join(root, "packages/web/package.json"),
          `{ "scripts": { "test": "vp test" } }`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--write", "--repository-root", root],
        });
        process.exitCode = 0;
        return stdout.text();
      })
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForARepairedEntryComposition",
        async ({ stderr }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          writeFileSync(
            join(root, "package.json"),
            `{ "scripts": { "guard": "vp run guard:all", "guard:all": "vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2" } }`,
            "utf8",
          );
          writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
          mkdirSync(join(root, "packages/web"), { recursive: true });
          writeFileSync(
            join(root, "packages/web/package.json"),
            `{ "scripts": { "test": "vp test" } }`,
            "utf8",
          );
          await runCommand(dontReviewItCommand, {
            rawArgs: ["check", "--write", "--repository-root", root],
          });
          process.exitCode = 0;
          return stderr.text().includes("entry-composition");
        },
      )
      .extend("theRepairedGuardScript", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(
          join(root, "package.json"),
          `{ "scripts": { "guard": "vp run guard:all", "guard:all": "vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2" } }`,
          "utf8",
        );
        writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
        mkdirSync(join(root, "packages/web"), { recursive: true });
        writeFileSync(
          join(root, "packages/web/package.json"),
          `{ "scripts": { "test": "vp test" } }`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--write", "--repository-root", root],
        });
        process.exitCode = 0;
        return readFileSync(join(root, "package.json"), "utf8").includes(
          "throttle --timeout 1800 -- spool -- vp run guard:all",
        );
      });

    it("exits zero", ({ theExitCodeOfARepairedEntryComposition }) => {
      expect(theExitCodeOfARepairedEntryComposition).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfARepairedEntryComposition }) => {
      expect(theStandardOutputOfARepairedEntryComposition).toBe("");
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForARepairedEntryComposition,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForARepairedEntryComposition).toBe(true);
    });

    it("wraps the guard script the repository declares", ({ theRepairedGuardScript }) => {
      expect(theRepairedGuardScript).toBe(true);
    });
  });

  describe("check --write on entries it must not repair", () => {
    const it = standardIoTest
      .extend("theExitCodeOfAnUnrepairableEntryComposition", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(
          join(root, "package.json"),
          `{ "scripts": { "guard": "throttle --timeout 1800 -- spool -- vp check" } }`,
          "utf8",
        );
        writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
        mkdirSync(join(root, "packages/web"), { recursive: true });
        writeFileSync(
          join(root, "packages/web/package.json"),
          `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
          "utf8",
        );
        await runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--write", "--repository-root", root],
        });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend(
        "theUnrepairableManifestIsNamedOnStandardOutput",
        async ({ stdout }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          writeFileSync(
            join(root, "package.json"),
            `{ "scripts": { "guard": "throttle --timeout 1800 -- spool -- vp check" } }`,
            "utf8",
          );
          writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
          mkdirSync(join(root, "packages/web"), { recursive: true });
          writeFileSync(
            join(root, "packages/web/package.json"),
            `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
            "utf8",
          );
          await runCommand(dontReviewItCommand, {
            rawArgs: ["check", "--write", "--repository-root", root],
          });
          process.exitCode = 0;
          return stdout.text().includes("packages/web/package.json");
        },
      )
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForAnUnrepairableEntryComposition",
        async ({ stderr }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          writeFileSync(
            join(root, "package.json"),
            `{ "scripts": { "guard": "throttle --timeout 1800 -- spool -- vp check" } }`,
            "utf8",
          );
          writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
          mkdirSync(join(root, "packages/web"), { recursive: true });
          writeFileSync(
            join(root, "packages/web/package.json"),
            `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
            "utf8",
          );
          await runCommand(dontReviewItCommand, {
            rawArgs: ["check", "--write", "--repository-root", root],
          });
          process.exitCode = 0;
          return stderr.text().includes("entry-composition");
        },
      );

    it("exits one", ({ theExitCodeOfAnUnrepairableEntryComposition }) => {
      expect(theExitCodeOfAnUnrepairableEntryComposition).toBe(1);
    });

    it("names the manifest it must not repair", ({
      theUnrepairableManifestIsNamedOnStandardOutput,
    }) => {
      expect(theUnrepairableManifestIsNamedOnStandardOutput).toBe(true);
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForAnUnrepairableEntryComposition,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForAnUnrepairableEntryComposition).toBe(
        true,
      );
    });
  });

  describe("a manifest that exists but does not parse", () => {
    const it = standardIoTest
      .extend("theExitCodeOfAnUnparsableManifest", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "package.json"), "{ oops", "utf8");
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theStandardOutputOfAnUnparsableManifest", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "package.json"), "{ oops", "utf8");
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text();
      })
      .extend("theUnparsableManifestIsNamedOnStandardError", async ({ stderr }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "package.json"), "{ oops", "utf8");
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stderr.text().includes("package.json exists but does not parse as a JSON object");
      });

    it("exits two", ({ theExitCodeOfAnUnparsableManifest }) => {
      expect(theExitCodeOfAnUnparsableManifest).toBe(2);
    });

    it("stays silent on standard output", ({ theStandardOutputOfAnUnparsableManifest }) => {
      expect(theStandardOutputOfAnUnparsableManifest).toBe("");
    });

    it("names the manifest it could not read on standard error", ({
      theUnparsableManifestIsNamedOnStandardError,
    }) => {
      expect(theUnparsableManifestIsNamedOnStandardError).toBe(true);
    });
  });

  describe("check --write on a manifest that exists but does not parse", () => {
    const it = standardIoTest
      .extend("theExitCodeOfWritingToAnUnparsableManifest", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "package.json"), "{ oops", "utf8");
        await runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--write", "--repository-root", root],
        });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend(
        "theUnparsableManifestIsNamedOnStandardErrorWhileWriting",
        async ({ stderr }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          writeFileSync(join(root, "package.json"), "{ oops", "utf8");
          await runCommand(dontReviewItCommand, {
            rawArgs: ["check", "--write", "--repository-root", root],
          });
          process.exitCode = 0;
          return stderr.text().includes("package.json exists but does not parse as a JSON object");
        },
      );

    it("exits two", ({ theExitCodeOfWritingToAnUnparsableManifest }) => {
      expect(theExitCodeOfWritingToAnUnparsableManifest).toBe(2);
    });

    it("names the manifest it could not read on standard error", ({
      theUnparsableManifestIsNamedOnStandardErrorWhileWriting,
    }) => {
      expect(theUnparsableManifestIsNamedOnStandardErrorWhileWriting).toBe(true);
    });
  });

  describe("a workflow definition that narrows its own start", () => {
    const it = standardIoTest
      .extend("theExitCodeOfANarrowedWorkflowStart", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, ".github/workflows"), { recursive: true });
        writeFileSync(
          join(root, ".github/workflows/ci.yml"),
          "on:\n  pull_request:\n    paths: [src/**]\npermissions:\n  contents: read\njobs:\n  ready:\n    steps:\n      - run: vp run guard\n",
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend(
        "theNarrowedWorkflowStartIsNamedOnStandardOutput",
        async ({ stdout }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          mkdirSync(join(root, ".github/workflows"), { recursive: true });
          writeFileSync(
            join(root, ".github/workflows/ci.yml"),
            "on:\n  pull_request:\n    paths: [src/**]\npermissions:\n  contents: read\njobs:\n  ready:\n    steps:\n      - run: vp run guard\n",
            "utf8",
          );
          await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
          process.exitCode = 0;
          return stdout.text().includes(".github/workflows/ci.yml:3");
        },
      );

    it("fails the check", ({ theExitCodeOfANarrowedWorkflowStart }) => {
      expect(theExitCodeOfANarrowedWorkflowStart).toBe(1);
    });

    it("names the line that narrowed the start", ({
      theNarrowedWorkflowStartIsNamedOnStandardOutput,
    }) => {
      expect(theNarrowedWorkflowStartIsNamedOnStandardOutput).toBe(true);
    });
  });

  describe("a workflow definition that keeps every discipline", () => {
    const it = standardIoTest
      .extend("theExitCodeOfADisciplinedWorkflow", async ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "renovate.json"), "{}\n", "utf8");
        mkdirSync(join(root, ".github/workflows"), { recursive: true });
        writeFileSync(
          join(root, ".github/workflows/ci.yml"),
          "name: CI\non:\n  pull_request:\npermissions:\n  contents: read\njobs:\n  ready:\n    steps:\n      - run: vp run guard\n",
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        const settled = process.exitCode;
        process.exitCode = 0;
        return typeof settled === "number" ? settled : 0;
      })
      .extend("theStandardOutputOfADisciplinedWorkflow", async ({ stdout }, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "renovate.json"), "{}\n", "utf8");
        mkdirSync(join(root, ".github/workflows"), { recursive: true });
        writeFileSync(
          join(root, ".github/workflows/ci.yml"),
          "name: CI\non:\n  pull_request:\npermissions:\n  contents: read\njobs:\n  ready:\n    steps:\n      - run: vp run guard\n",
          "utf8",
        );
        await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
        process.exitCode = 0;
        return stdout.text();
      })
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForADisciplinedWorkflow",
        async ({ stderr }, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
          onCleanup(() => {
            rmSync(root, { recursive: true, force: true });
          });
          writeFileSync(join(root, "renovate.json"), "{}\n", "utf8");
          mkdirSync(join(root, ".github/workflows"), { recursive: true });
          writeFileSync(
            join(root, ".github/workflows/ci.yml"),
            "name: CI\non:\n  pull_request:\npermissions:\n  contents: read\njobs:\n  ready:\n    steps:\n      - run: vp run guard\n",
            "utf8",
          );
          await runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] });
          process.exitCode = 0;
          return stderr.text().includes("entry-composition");
        },
      );

    it("exits zero", ({ theExitCodeOfADisciplinedWorkflow }) => {
      expect(theExitCodeOfADisciplinedWorkflow).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfADisciplinedWorkflow }) => {
      expect(theStandardOutputOfADisciplinedWorkflow).toBe("");
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForADisciplinedWorkflow,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForADisciplinedWorkflow).toBe(true);
    });
  });
});
