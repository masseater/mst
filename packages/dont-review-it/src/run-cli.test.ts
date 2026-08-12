import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./lint/oxlint/lib/canonical-values/annotation.ts";
import { runDontReviewIt } from "./run-cli.ts";

const CANONICAL_VALUES_TAG = "@canonical-values";

const UNNAMED_CONCEPT_REPORT =
  'A canonical values annotation must name the concept it declares. Write the tag followed by a concept id built from lowercase words joined by "-" or ".".';

const USAGE_REPORT = `Usage: dont-review-it <command> [--repository-root <path>]

Commands:
  verify               Report every broken or retired canonical values annotation, and exit non-zero when any is found.
  equivalent-concepts  Report every value set that more than one concept declares.
  duplicated-bodies    Report every body that more than one declaration spells the same way.

Options:
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
`;

const it = test
  .extend("wellFormedVerifyRun", () => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "order.ts"),
      `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
      "utf8",
    );
    return runDontReviewIt(["verify", "--repository-root", root]);
  })
  .extend("workingDirectoryRun", () => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
    const enteredFrom = process.cwd();
    onTestFinished(() => {
      process.chdir(enteredFrom);
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "order.ts"),
      `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
      "utf8",
    );
    process.chdir(root);
    return runDontReviewIt(["equivalent-concepts"]);
  })
  .extend("brokenAnnotationVerifyRun", () => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "order.ts"),
      `/** ${CANONICAL_VALUES_TAG} */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
      "utf8",
    );
    return runDontReviewIt(["verify", "--repository-root", root]);
  })
  .extend("dotDirectoryVerifyRun", () => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, ".config"), { recursive: true });
    writeFileSync(
      join(root, ".config", "broken.ts"),
      `/** ${CANONICAL_VALUES_TAG} NOT VALID ID */\nexport const BROKEN_STATUSES = ["draft"] as const;\n`,
      "utf8",
    );
    return runDontReviewIt(["verify", "--repository-root", root]);
  })
  .extend("retiredTagVerifyRun", () => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(
      join(root, "scripts", "legacy.mjs"),
      `/** ${RETIRED_ANNOTATION_TAGS[0]} */\nexport const LEGACY_STATUSES = ["draft"];\n`,
      "utf8",
    );
    return runDontReviewIt(["verify", "--repository-root", root]);
  })
  .extend("repeatedInTestFileVerifyRun", () => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "order.test.ts"),
      `/** ${CANONICAL_VALUES_TAG} order.status */\nconst FIXTURE_STATUSES = ["draft"] as const;\n`,
      "utf8",
    );
    writeFileSync(
      join(root, "src", "order.ts"),
      `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
      "utf8",
    );
    return runDontReviewIt(["verify", "--repository-root", root]);
  })
  .extend("equivalentConceptsRun", () => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "article.ts"),
      `/** ${CANONICAL_VALUES_TAG} article.status */\nexport const ARTICLE_STATUSES = ["published", "draft"] as const;\n`,
      "utf8",
    );
    writeFileSync(
      join(root, "src", "order.ts"),
      `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
      "utf8",
    );
    return runDontReviewIt(["equivalent-concepts", "--repository-root", root]);
  })
  .extend("unknownCommandRun", () => runDontReviewIt(["publish"]))
  .extend("namelessCommandRun", () => runDontReviewIt([]))
  .extend("missingRepositoryRootPath", () => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return join(root, "missing");
  })
  .extend("missingRepositoryRootRun", ({ missingRepositoryRootPath }) =>
    runDontReviewIt(["verify", "--repository-root", missingRepositoryRootPath]),
  )
  .extend("unknownOptionRun", () => runDontReviewIt(["verify", "--repo-root", "."]))
  .extend("uniqueBodiesRun", () => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "twice.ts"),
      "export const twice = (value: number): number => value * 2;\n",
      "utf8",
    );
    writeFileSync(
      join(root, "src", "thrice.ts"),
      "export const thrice = (value: number): number => value * 3;\n",
      "utf8",
    );
    return runDontReviewIt(["duplicated-bodies", "--repository-root", root]);
  })
  .extend("duplicatedBodiesRun", () => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "twice.ts"),
      "export const twice = (value: number): number => value * 2;\n",
      "utf8",
    );
    writeFileSync(
      join(root, "src", "doubled.ts"),
      "export const doubled = (value: number): number => value * 2;\n",
      "utf8",
    );
    return runDontReviewIt(["duplicated-bodies", "--repository-root", root]);
  })
  .extend("duplicatedBodyInTestFileRun", () => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "twice.ts"),
      "export const twice = (value: number): number => value * 2;\n",
      "utf8",
    );
    writeFileSync(
      join(root, "src", "twice.test.ts"),
      "export const doubled = (value: number): number => value * 2;\n",
      "utf8",
    );
    return runDontReviewIt(["duplicated-bodies", "--repository-root", root]);
  });

describe("run-cli", () => {
  it("verify stays silent and exits zero when every annotation is well formed", ({
    wellFormedVerifyRun,
  }) => {
    expect(wellFormedVerifyRun).toStrictEqual({ exitCode: 0, out: "", error: "" });
  });

  it("a command given no repository root scans the working directory", ({
    workingDirectoryRun,
  }) => {
    expect(workingDirectoryRun).toStrictEqual({ exitCode: 0, out: "", error: "" });
  });

  it("verify returns the problem as output and exits one", ({ brokenAnnotationVerifyRun }) => {
    expect(brokenAnnotationVerifyRun).toStrictEqual({
      exitCode: 1,
      out: `src/order.ts:1 ${UNNAMED_CONCEPT_REPORT}\n`,
      error: "",
    });
  });

  it("verify reaches a broken annotation that sits in a dot directory", ({
    dotDirectoryVerifyRun,
  }) => {
    expect(dotDirectoryVerifyRun).toStrictEqual({
      exitCode: 1,
      out: `.config/broken.ts:1 ${UNNAMED_CONCEPT_REPORT}\n`,
      error: "",
    });
  });

  it("verify rejects a retired annotation tag left in a JavaScript file", ({
    retiredTagVerifyRun,
  }) => {
    expect(retiredTagVerifyRun).toStrictEqual({
      exitCode: 1,
      out: "scripts/legacy.mjs:1 The retired annotation tag @canonical-values-exempt must not stay in the source, because opting a value set out of the canonical vocabulary is no longer possible. Delete the tag, and declare the concept it belonged to so every use derives from that declaration.\n",
      error: "",
    });
  });

  it("a concept a test file repeats is never reported against the declaration that owns it", ({
    repeatedInTestFileVerifyRun,
  }) => {
    expect(repeatedInTestFileVerifyRun).toStrictEqual({ exitCode: 0, out: "", error: "" });
  });

  it("equivalent-concepts returns the group it found and still exits zero", ({
    equivalentConceptsRun,
  }) => {
    expect(equivalentConceptsRun).toStrictEqual({
      exitCode: 0,
      out: '"draft", "published" is declared by more than one concept: article.status (src/article.ts), order.status (src/order.ts)\n',
      error: "",
    });
  });

  it("an unknown command returns the usage as an error and exits two", ({ unknownCommandRun }) => {
    expect(unknownCommandRun).toStrictEqual({ exitCode: 2, out: "", error: USAGE_REPORT });
  });

  it("no command at all is answered the same way an unknown command is", ({
    namelessCommandRun,
    unknownCommandRun,
  }) => {
    expect(namelessCommandRun).toStrictEqual(unknownCommandRun);
  });

  it("a repository root that is not a directory exits two instead of scanning nothing", ({
    missingRepositoryRootPath,
    missingRepositoryRootRun,
  }) => {
    expect(missingRepositoryRootRun).toStrictEqual({
      exitCode: 2,
      out: "",
      error: `${missingRepositoryRootPath} is not a directory that can be scanned.\n`,
    });
  });

  it("an unknown option exits two instead of falling back to a default", ({ unknownOptionRun }) => {
    expect(unknownOptionRun).toStrictEqual({
      exitCode: 2,
      out: "",
      error: `Unknown option '--repo-root'. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- "--repo-root"\n`,
    });
  });

  it("duplicated-bodies stays silent when no body is spelled twice", ({ uniqueBodiesRun }) => {
    expect(uniqueBodiesRun).toStrictEqual({ exitCode: 0, out: "", error: "" });
  });

  it("duplicated-bodies names both sites when a body is spelled twice", ({
    duplicatedBodiesRun,
  }) => {
    expect(duplicatedBodiesRun).toStrictEqual({
      exitCode: 0,
      out: "src/doubled.ts:1 doubled == src/twice.ts:1 twice\n",
      error: "",
    });
  });

  it("duplicated-bodies leaves test files out of the scan", ({ duplicatedBodyInTestFileRun }) => {
    expect(duplicatedBodyInTestFileRun).toStrictEqual({ exitCode: 0, out: "", error: "" });
  });
});
