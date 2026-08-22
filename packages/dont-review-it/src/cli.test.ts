import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vite-plus/test";

import { fingerprintValues } from "./lint/oxlint/lib/canonical-values/fingerprint.ts";

const NO_LOCAL_RULE = "dont-review-it/no-local-finite-value-set--use-or-register-canonical-values";

const NO_STRICT_RULE = "dont-review-it/no-strict-canonical-literal-use--use-canonical-import";

const NO_LOCAL_CODE = "dont-review-it(no-local-finite-value-set--use-or-register-canonical-values)";

const NO_STRICT_CODE = "dont-review-it(no-strict-canonical-literal-use--use-canonical-import)";

const CANONICAL_VALUES_SUCCESS_LINE =
  /^(?:checked canonical-values \d+ source files? 0 problems 0 warnings|[ \t]+✓ canonical-values[ \t]+\d+ source files?)$/mu;

const CLI_PATH = fileURLToPath(new URL("./cli.ts", import.meta.url));

const PLUGIN_PATH = fileURLToPath(new URL("./plugin.ts", import.meta.url));

const PROCESS_TIMEOUT = 180_000;

const SPAWN_SETTINGS: SpawnSyncOptionsWithStringEncoding = {
  encoding: "utf8",
  env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  timeout: PROCESS_TIMEOUT,
};

const CHECK_ARGUMENTS = [CLI_PATH, "check", "--repository-root"];

const LINT_TAIL = ["--format", "json", "--threads", "1"];

const CACHE_RELATIVE_PATH = "node_modules/.cache/mst-dont-review-it/canonical-values.json";

const PACKAGE_MANIFEST = JSON.stringify({
  name: "canonical-values-e2e",
  private: true,
  scripts: { guard: "throttle --timeout 1800 -- spool -- vp check" },
  type: "module",
  workspaces: [],
});

const WORKSPACE_MANIFEST = JSON.stringify({
  name: "canonical-values-e2e",
  private: true,
  scripts: { guard: "throttle --timeout 1800 -- spool -- vp check" },
  type: "module",
  workspaces: ["packages/*"],
});

const LINT_CONFIG_SOURCE = `export default ${JSON.stringify({
  lint: {
    categories: { correctness: "off" },
    plugins: [],
    jsPlugins: [{ name: "dont-review-it", specifier: PLUGIN_PATH }],
    rules: { [NO_LOCAL_RULE]: "error", [NO_STRICT_RULE]: "error" },
  },
})};\n`;

const BASE_FILES = { "package.json": PACKAGE_MANIFEST, "vite.config.ts": LINT_CONFIG_SOURCE };

const OWNER_OF_DRAFT =
  '/** @canonical-values real.status */\nexport const REAL_STATUSES = ["draft"] as const;\n';

const OWNER_OF_PUBLISHED =
  '/** @canonical-values real.status */\nexport const REAL_STATUSES = ["published"] as const;\n';

const CONSUMER_OF_DRAFT = 'export const selected = "draft";\n';

const OWNER_AND_CONSUMER_FILES = {
  ...BASE_FILES,
  "src/consumer.ts": CONSUMER_OF_DRAFT,
  "src/owner.ts": OWNER_OF_DRAFT,
};

const TOP_LEVEL_IF_FILES = {
  ...BASE_FILES,
  "src/invalid.ts": '/** @canonical-values fake.if */\nif (true) consume("draft");\n',
  "src/owner.ts": OWNER_OF_DRAFT,
};

const NESTED_ANNOTATION_FILES = {
  ...BASE_FILES,
  "src/invalid.ts":
    'export function load() {\n  /** @canonical-values fake.nested */\n  return "other";\n}\nexport const BAIT = ["published"] as const;\n',
  "src/owner.ts": OWNER_OF_PUBLISHED,
};

const STORY_AND_FIXTURE_FILES = {
  ...BASE_FILES,
  "fixtures/status.ts":
    '/** @canonical-values real.status */\nexport const FIXTURE_STATUSES = ["draft"] as const;\n',
  "src/Owner.stories.ts":
    '/** @canonical-values real.status */\nexport const STORY_STATUSES = ["draft"] as const;\n',
  "src/consumer.ts": CONSUMER_OF_DRAFT,
  "src/owner.ts": OWNER_OF_DRAFT,
};

const ANNOTATED_RE_EXPORT_FILES = {
  ...BASE_FILES,
  "src/invalid.ts":
    '/** @canonical-values fake.re-export */\nexport { VALUES } from "./values.ts";\nexport const fallback = "draft";\n',
  "src/owner.ts": OWNER_OF_DRAFT,
  "src/values.ts": 'export const VALUES = ["other"] as const;\n',
};

const PACKAGE_ROUTE_FILES = {
  "package.json": WORKSPACE_MANIFEST,
  "vite.config.ts": LINT_CONFIG_SOURCE,
  "packages/vocabulary/package.json": JSON.stringify({
    name: "@fixture/vocabulary",
    private: true,
    exports: { ".": "./src/index.ts", "./alias": "./src/alias.ts", "./shadow": "./src/shadow.ts" },
  }),
  "packages/vocabulary/src/alias.ts":
    'export { ORDER_STATUSES as PUBLIC_STATUSES } from "./owner.ts";\n',
  "packages/vocabulary/src/index.ts": 'export { ORDER_STATUSES } from "./owner.ts";\n',
  "packages/vocabulary/src/owner.ts":
    '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
  "packages/vocabulary/src/shadow.ts":
    'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
  "src/alias-consumer.ts":
    'import { PUBLIC_STATUSES } from "@fixture/vocabulary/alias";\nexport const schema = z.enum(PUBLIC_STATUSES);\n',
  "src/shadow-consumer.ts":
    'import { ORDER_STATUSES } from "@fixture/vocabulary/shadow";\nexport const schema = z.enum(ORDER_STATUSES);\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "@fixture/vocabulary": ["packages/vocabulary/src/index.ts"],
        "@fixture/vocabulary/*": ["packages/vocabulary/src/*"],
      },
    },
  }),
};

const AMBIENT_GLOBAL_FILES = {
  ...PACKAGE_ROUTE_FILES,
  "src/globals.d.ts": 'declare const ORDER_STATUSES: readonly ["shadow", "values"];\n',
  "src/global-consumer.ts": "export const schema = z.enum(ORDER_STATUSES);\n",
};

const PROPERTY_VOCABULARY_FILES = {
  ...BASE_FILES,
  "src/import-type.ts": 'export type Status = keyof import("./shape.ts").Shape;\n',
  "src/object-keys.ts":
    'import { SHAPE } from "./shape.ts";\nexport const schema = z.enum(Object.keys(SHAPE));\n',
  "src/shape.ts":
    "export interface Shape { draft: 0; published: 1 }\nexport const SHAPE = { draft: 0, published: 1 };\n",
  "src/type-import.ts":
    'import type { Shape } from "./shape.ts";\nexport type Status = keyof Shape;\n',
};

const POISONED_CACHE_FILES = {
  ...BASE_FILES,
  "src/consumer.ts": 'export const poison = "poison";\nexport const actual = "draft";\n',
  "src/owner.ts": OWNER_OF_DRAFT,
};

const NEGATIVE_AND_NULL_FILES = {
  ...BASE_FILES,
  "src/base.ts": "/** @canonical-values retry.base */\nexport const BASE = [-1, null] as const;\n",
  "src/consumer.ts": 'export const observed = [-1, null, 1, "draft", "published"] as const;\n',
  "src/order.ts":
    '/** @canonical-values order.status */\nexport const ORDER_STATUS = { draft: { label: "Draft" }, published: { label: "Published" } } as const;\n',
  "src/retry.ts":
    'import { BASE } from "./base.ts";\n/** @canonical-values retry.outcome */\nexport const OUTCOMES = [...BASE, 1] as const;\n',
};

const NUL_BEARING_FILES = {
  ...BASE_FILES,
  "src/joined.ts":
    '/** @canonical-values joined.value */\nexport const JOINED = ["a\\0string:b"] as const;\n',
  "src/pair.ts": '/** @canonical-values pair.value */\nexport const PAIR = ["a", "b"] as const;\n',
};

const SAME_LINE_DUPLICATE_FILES = {
  ...BASE_FILES,
  "src/duplicate.ts":
    '/** @canonical-values order.status */ const A = ["draft"] as const; /** @canonical-values order.status */ const B = ["published"] as const;\nexport type Status = "draft" | "published";\n',
};

const POISON_CACHE_ENTRY = {
  annotationStart: 0,
  binding: "POISON",
  bindingStart: 20,
  conceptId: "poison.cache",
  declarationEnd: 30,
  declarationPath: "src/consumer.ts",
  declarationStart: 10,
  importRoutes: [],
  packageName: "canonical-values-e2e",
  values: ["poison"],
  fingerprint: fingerprintValues(["poison"]),
};

describe("canonical values process e2e", { timeout: PROCESS_TIMEOUT * 4 }, () => {
  describe("a canonical owner beside the consumer that writes its literal", () => {
    const it = test
      .extend("theExitCodeOfVerifyingACanonicalOwner", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(OWNER_AND_CONSUMER_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return typeof checked.status === "number" ? checked.status : -1;
      })
      .extend("theStandardOutputOfVerifyingACanonicalOwnerIsEmpty", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(OWNER_AND_CONSUMER_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return checked.stdout === "";
      })
      .extend("theCanonicalValuesLineOnVerifyingACanonicalOwner", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(OWNER_AND_CONSUMER_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return CANONICAL_VALUES_SUCCESS_LINE.test(checked.stderr);
      })
      .extend("theExitCodeOfLintingACanonicalOwner", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(OWNER_AND_CONSUMER_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/owner.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theExitCodeOfLintingTheConsumerOfACanonicalOwner", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(OWNER_AND_CONSUMER_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theStrictLiteralRuleOnTheConsumerOfACanonicalOwner", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(OWNER_AND_CONSUMER_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        return linted.stdout.includes(NO_STRICT_CODE);
      });

    it("verifies the repository", ({ theExitCodeOfVerifyingACanonicalOwner }) => {
      expect(theExitCodeOfVerifyingACanonicalOwner).toBe(0);
    });

    it("stays silent on standard output", ({
      theStandardOutputOfVerifyingACanonicalOwnerIsEmpty,
    }) => {
      expect(theStandardOutputOfVerifyingACanonicalOwnerIsEmpty).toBe(true);
    });

    it("announces the canonical-values check on standard error", ({
      theCanonicalValuesLineOnVerifyingACanonicalOwner,
    }) => {
      expect(theCanonicalValuesLineOnVerifyingACanonicalOwner).toBe(true);
    });

    it("leaves the owner unreported", ({ theExitCodeOfLintingACanonicalOwner }) => {
      expect(theExitCodeOfLintingACanonicalOwner).toBe(0);
    });

    it("fails the lint of the consumer", ({ theExitCodeOfLintingTheConsumerOfACanonicalOwner }) => {
      expect(theExitCodeOfLintingTheConsumerOfACanonicalOwner).toBe(1);
    });

    it("names the strict-literal rule on the consumer", ({
      theStrictLiteralRuleOnTheConsumerOfACanonicalOwner,
    }) => {
      expect(theStrictLiteralRuleOnTheConsumerOfACanonicalOwner).toBe(true);
    });
  });

  describe("a top-level if carrying an annotation", () => {
    const it = test
      .extend("theExitCodeOfVerifyingATopLevelIfAnnotation", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(TOP_LEVEL_IF_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return typeof checked.status === "number" ? checked.status : -1;
      })
      .extend("theSiteReportedForATopLevelIfAnnotation", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(TOP_LEVEL_IF_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return checked.stdout.includes("src/invalid.ts:1");
      })
      .extend("theExitCodeOfLintingATopLevelIfAnnotation", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(TOP_LEVEL_IF_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/invalid.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theStrictLiteralRuleOnATopLevelIfAnnotation", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(TOP_LEVEL_IF_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/invalid.ts", ...LINT_TAIL], settings);
        return linted.stdout.includes(NO_STRICT_CODE);
      });

    it("fails verification", ({ theExitCodeOfVerifyingATopLevelIfAnnotation }) => {
      expect(theExitCodeOfVerifyingATopLevelIfAnnotation).toBe(1);
    });

    it("names the annotated line", ({ theSiteReportedForATopLevelIfAnnotation }) => {
      expect(theSiteReportedForATopLevelIfAnnotation).toBe(true);
    });

    it("fails the lint of the annotated file", ({ theExitCodeOfLintingATopLevelIfAnnotation }) => {
      expect(theExitCodeOfLintingATopLevelIfAnnotation).toBe(1);
    });

    it("grants the annotated file no exemption", ({
      theStrictLiteralRuleOnATopLevelIfAnnotation,
    }) => {
      expect(theStrictLiteralRuleOnATopLevelIfAnnotation).toBe(true);
    });
  });

  describe("a nested annotation standing in front of a bait declaration", () => {
    const it = test
      .extend("theExitCodeOfVerifyingANestedAnnotation", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NESTED_ANNOTATION_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return typeof checked.status === "number" ? checked.status : -1;
      })
      .extend("theSiteReportedForANestedAnnotation", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NESTED_ANNOTATION_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return checked.stdout.includes("src/invalid.ts:2");
      })
      .extend("theExitCodeOfLintingANestedAnnotation", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NESTED_ANNOTATION_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/invalid.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theStrictLiteralRuleOnANestedAnnotation", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NESTED_ANNOTATION_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/invalid.ts", ...LINT_TAIL], settings);
        return linted.stdout.includes(NO_STRICT_CODE);
      });

    it("fails verification", ({ theExitCodeOfVerifyingANestedAnnotation }) => {
      expect(theExitCodeOfVerifyingANestedAnnotation).toBe(1);
    });

    it("names the nested annotation line", ({ theSiteReportedForANestedAnnotation }) => {
      expect(theSiteReportedForANestedAnnotation).toBe(true);
    });

    it("fails the lint of the baiting file", ({ theExitCodeOfLintingANestedAnnotation }) => {
      expect(theExitCodeOfLintingANestedAnnotation).toBe(1);
    });

    it("turns the bait into no exempt owner", ({ theStrictLiteralRuleOnANestedAnnotation }) => {
      expect(theStrictLiteralRuleOnANestedAnnotation).toBe(true);
    });
  });

  describe("story and fixture annotations outside the production catalog", () => {
    const it = test
      .extend("theExitCodeOfVerifyingStoryAndFixtureAnnotations", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(STORY_AND_FIXTURE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return typeof checked.status === "number" ? checked.status : -1;
      })
      .extend("theFixtureSiteReportedForStoryAndFixtureAnnotations", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(STORY_AND_FIXTURE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return checked.stdout.includes("fixtures/status.ts:1");
      })
      .extend("theStorySiteReportedForStoryAndFixtureAnnotations", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(STORY_AND_FIXTURE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return checked.stdout.includes("src/Owner.stories.ts:1");
      })
      .extend("theAlreadyDeclaredComplaintForStoryAndFixtureAnnotations", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(STORY_AND_FIXTURE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return checked.stdout.includes("already declared");
      })
      .extend("theExitCodeOfLintingTheConsumerBesideStoryAnnotations", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(STORY_AND_FIXTURE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theConceptReportedOnTheConsumerBesideStoryAnnotations", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(STORY_AND_FIXTURE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return messagesIn(JSON.parse(linted.stdout)).join("\n").includes("real.status");
      });

    it("fails verification", ({ theExitCodeOfVerifyingStoryAndFixtureAnnotations }) => {
      expect(theExitCodeOfVerifyingStoryAndFixtureAnnotations).toBe(1);
    });

    it("names the fixture declaration site", ({
      theFixtureSiteReportedForStoryAndFixtureAnnotations,
    }) => {
      expect(theFixtureSiteReportedForStoryAndFixtureAnnotations).toBe(true);
    });

    it("names the story declaration site", ({
      theStorySiteReportedForStoryAndFixtureAnnotations,
    }) => {
      expect(theStorySiteReportedForStoryAndFixtureAnnotations).toBe(true);
    });

    it("treats neither as a second declaration of the concept", ({
      theAlreadyDeclaredComplaintForStoryAndFixtureAnnotations,
    }) => {
      expect(theAlreadyDeclaredComplaintForStoryAndFixtureAnnotations).toBe(false);
    });

    it("fails the lint of the consumer", ({
      theExitCodeOfLintingTheConsumerBesideStoryAnnotations,
    }) => {
      expect(theExitCodeOfLintingTheConsumerBesideStoryAnnotations).toBe(1);
    });

    it("names the production concept on the consumer", ({
      theConceptReportedOnTheConsumerBesideStoryAnnotations,
    }) => {
      expect(theConceptReportedOnTheConsumerBesideStoryAnnotations).toBe(true);
    });
  });

  describe("a re-export carrying an annotation", () => {
    const it = test
      .extend("theExitCodeOfVerifyingAnAnnotatedReExport", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(ANNOTATED_RE_EXPORT_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return typeof checked.status === "number" ? checked.status : -1;
      })
      .extend("theSiteReportedForAnAnnotatedReExport", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(ANNOTATED_RE_EXPORT_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return checked.stdout.includes("src/invalid.ts:1");
      })
      .extend("theExitCodeOfLintingAnAnnotatedReExport", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(ANNOTATED_RE_EXPORT_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/invalid.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theStrictLiteralRuleOnAnAnnotatedReExport", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(ANNOTATED_RE_EXPORT_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/invalid.ts", ...LINT_TAIL], settings);
        return linted.stdout.includes(NO_STRICT_CODE);
      });

    it("fails verification", ({ theExitCodeOfVerifyingAnAnnotatedReExport }) => {
      expect(theExitCodeOfVerifyingAnAnnotatedReExport).toBe(1);
    });

    it("names the annotated line", ({ theSiteReportedForAnAnnotatedReExport }) => {
      expect(theSiteReportedForAnAnnotatedReExport).toBe(true);
    });

    it("fails the lint of the re-exporting file", ({ theExitCodeOfLintingAnAnnotatedReExport }) => {
      expect(theExitCodeOfLintingAnAnnotatedReExport).toBe(1);
    });

    it("grants the re-export no range exemption", ({
      theStrictLiteralRuleOnAnAnnotatedReExport,
    }) => {
      expect(theStrictLiteralRuleOnAnAnnotatedReExport).toBe(true);
    });
  });

  describe("a vocabulary package exposing a shadow subpath beside an alias subpath", () => {
    describe("verifying the workspace", () => {
      const it = test
        .extend("theExitCodeOfVerifyingThePackageRoutes", ({}, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
          onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
          for (const [relativePath, fileText] of Object.entries(PACKAGE_ROUTE_FILES)) {
            mkdirSync(dirname(join(root, relativePath)), { recursive: true });
            writeFileSync(join(root, relativePath), fileText, "utf8");
          }
          const settings = { ...SPAWN_SETTINGS, cwd: root };
          const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
          return typeof checked.status === "number" ? checked.status : -1;
        })
        .extend("theStandardOutputOfVerifyingThePackageRoutesIsEmpty", ({}, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
          onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
          for (const [relativePath, fileText] of Object.entries(PACKAGE_ROUTE_FILES)) {
            mkdirSync(dirname(join(root, relativePath)), { recursive: true });
            writeFileSync(join(root, relativePath), fileText, "utf8");
          }
          const settings = { ...SPAWN_SETTINGS, cwd: root };
          const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
          return checked.stdout === "";
        })
        .extend("theCanonicalValuesLineOnVerifyingThePackageRoutes", ({}, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
          onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
          for (const [relativePath, fileText] of Object.entries(PACKAGE_ROUTE_FILES)) {
            mkdirSync(dirname(join(root, relativePath)), { recursive: true });
            writeFileSync(join(root, relativePath), fileText, "utf8");
          }
          const settings = { ...SPAWN_SETTINGS, cwd: root };
          const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
          return CANONICAL_VALUES_SUCCESS_LINE.test(checked.stderr);
        });

      it("verifies the workspace", ({ theExitCodeOfVerifyingThePackageRoutes }) => {
        expect(theExitCodeOfVerifyingThePackageRoutes).toBe(0);
      });

      it("stays silent on standard output", ({
        theStandardOutputOfVerifyingThePackageRoutesIsEmpty,
      }) => {
        expect(theStandardOutputOfVerifyingThePackageRoutesIsEmpty).toBe(true);
      });

      it("announces the canonical-values check on standard error", ({
        theCanonicalValuesLineOnVerifyingThePackageRoutes,
      }) => {
        expect(theCanonicalValuesLineOnVerifyingThePackageRoutes).toBe(true);
      });
    });

    describe("the consumer importing through the shadow subpath", () => {
      const it = test
        .extend("theExitCodeOfLintingTheShadowConsumer", ({}, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
          onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
          for (const [relativePath, fileText] of Object.entries(PACKAGE_ROUTE_FILES)) {
            mkdirSync(dirname(join(root, relativePath)), { recursive: true });
            writeFileSync(join(root, relativePath), fileText, "utf8");
          }
          const settings = { ...SPAWN_SETTINGS, cwd: root };
          const linted = spawnSync(
            "vp",
            ["lint", "src/shadow-consumer.ts", ...LINT_TAIL],
            settings,
          );
          return typeof linted.status === "number" ? linted.status : -1;
        })
        .extend("theLocalValueSetRuleOnTheShadowConsumer", ({}, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
          onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
          for (const [relativePath, fileText] of Object.entries(PACKAGE_ROUTE_FILES)) {
            mkdirSync(dirname(join(root, relativePath)), { recursive: true });
            writeFileSync(join(root, relativePath), fileText, "utf8");
          }
          const settings = { ...SPAWN_SETTINGS, cwd: root };
          const linted = spawnSync(
            "vp",
            ["lint", "src/shadow-consumer.ts", ...LINT_TAIL],
            settings,
          );
          return linted.stdout.includes(NO_LOCAL_CODE);
        })
        .extend("theUnregisteredRouteComplaintOnTheShadowConsumer", ({}, { onCleanup }) => {
          const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
          onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
          for (const [relativePath, fileText] of Object.entries(PACKAGE_ROUTE_FILES)) {
            mkdirSync(dirname(join(root, relativePath)), { recursive: true });
            writeFileSync(join(root, relativePath), fileText, "utf8");
          }
          const settings = { ...SPAWN_SETTINGS, cwd: root };
          const linted = spawnSync(
            "vp",
            ["lint", "src/shadow-consumer.ts", ...LINT_TAIL],
            settings,
          );
          const messagesIn = (jsonNode: unknown): readonly string[] => {
            if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
            if (jsonNode === null || typeof jsonNode !== "object") return [];
            return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
              fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
            );
          };
          return messagesIn(JSON.parse(linted.stdout))
            .join("\n")
            .includes("neither a registered public export path");
        });

      it("fails the lint", ({ theExitCodeOfLintingTheShadowConsumer }) => {
        expect(theExitCodeOfLintingTheShadowConsumer).toBe(1);
      });

      it("names the local-value-set rule", ({ theLocalValueSetRuleOnTheShadowConsumer }) => {
        expect(theLocalValueSetRuleOnTheShadowConsumer).toBe(true);
      });

      it("calls the subpath an unregistered route", ({
        theUnregisteredRouteComplaintOnTheShadowConsumer,
      }) => {
        expect(theUnregisteredRouteComplaintOnTheShadowConsumer).toBe(true);
      });
    });

    describe("the consumer importing through the alias subpath", () => {
      const it = test.extend("theExitCodeOfLintingTheAliasConsumer", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(PACKAGE_ROUTE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/alias-consumer.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      });

      it("passes the lint", ({ theExitCodeOfLintingTheAliasConsumer }) => {
        expect(theExitCodeOfLintingTheAliasConsumer).toBe(0);
      });
    });
  });

  describe("an ambient global carrying the binding name of an owner", () => {
    const it = test
      .extend("theExitCodeOfLintingTheGlobalConsumer", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(AMBIENT_GLOBAL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/global-consumer.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theLocalValueSetRuleOnTheGlobalConsumer", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(AMBIENT_GLOBAL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/global-consumer.ts", ...LINT_TAIL], settings);
        return linted.stdout.includes(NO_LOCAL_CODE);
      })
      .extend("theUnregisteredRouteComplaintOnTheGlobalConsumer", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(AMBIENT_GLOBAL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/global-consumer.ts", ...LINT_TAIL], settings);
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return messagesIn(JSON.parse(linted.stdout))
          .join("\n")
          .includes("neither a registered public export path");
      });

    it("fails the lint", ({ theExitCodeOfLintingTheGlobalConsumer }) => {
      expect(theExitCodeOfLintingTheGlobalConsumer).toBe(1);
    });

    it("names the local-value-set rule", ({ theLocalValueSetRuleOnTheGlobalConsumer }) => {
      expect(theLocalValueSetRuleOnTheGlobalConsumer).toBe(true);
    });

    it("calls the ambient global an unregistered route", ({
      theUnregisteredRouteComplaintOnTheGlobalConsumer,
    }) => {
      expect(theUnregisteredRouteComplaintOnTheGlobalConsumer).toBe(true);
    });
  });

  describe("a property vocabulary reached through a type-only import", () => {
    const it = test
      .extend("theExitCodeOfLintingTheTypeOnlyImport", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(PROPERTY_VOCABULARY_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/type-import.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theLocalValueSetRuleOnTheTypeOnlyImport", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(PROPERTY_VOCABULARY_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/type-import.ts", ...LINT_TAIL], settings);
        return linted.stdout.includes(NO_LOCAL_CODE);
      })
      .extend("theUnregisteredRouteComplaintOnTheTypeOnlyImport", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(PROPERTY_VOCABULARY_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/type-import.ts", ...LINT_TAIL], settings);
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return messagesIn(JSON.parse(linted.stdout))
          .join("\n")
          .includes("neither a registered public export path");
      });

    it("fails the lint", ({ theExitCodeOfLintingTheTypeOnlyImport }) => {
      expect(theExitCodeOfLintingTheTypeOnlyImport).toBe(1);
    });

    it("names the local-value-set rule", ({ theLocalValueSetRuleOnTheTypeOnlyImport }) => {
      expect(theLocalValueSetRuleOnTheTypeOnlyImport).toBe(true);
    });

    it("keeps the route identity across the module boundary", ({
      theUnregisteredRouteComplaintOnTheTypeOnlyImport,
    }) => {
      expect(theUnregisteredRouteComplaintOnTheTypeOnlyImport).toBe(true);
    });
  });

  describe("a property vocabulary reached through an inline import type", () => {
    const it = test
      .extend("theExitCodeOfLintingTheInlineImportType", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(PROPERTY_VOCABULARY_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/import-type.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theLocalValueSetRuleOnTheInlineImportType", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(PROPERTY_VOCABULARY_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/import-type.ts", ...LINT_TAIL], settings);
        return linted.stdout.includes(NO_LOCAL_CODE);
      })
      .extend("theUnregisteredRouteComplaintOnTheInlineImportType", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(PROPERTY_VOCABULARY_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/import-type.ts", ...LINT_TAIL], settings);
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return messagesIn(JSON.parse(linted.stdout))
          .join("\n")
          .includes("neither a registered public export path");
      });

    it("fails the lint", ({ theExitCodeOfLintingTheInlineImportType }) => {
      expect(theExitCodeOfLintingTheInlineImportType).toBe(1);
    });

    it("names the local-value-set rule", ({ theLocalValueSetRuleOnTheInlineImportType }) => {
      expect(theLocalValueSetRuleOnTheInlineImportType).toBe(true);
    });

    it("keeps the route identity across the module boundary", ({
      theUnregisteredRouteComplaintOnTheInlineImportType,
    }) => {
      expect(theUnregisteredRouteComplaintOnTheInlineImportType).toBe(true);
    });
  });

  describe("a property vocabulary reached through the keys of an imported shape", () => {
    const it = test
      .extend("theExitCodeOfLintingTheObjectKeyReader", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(PROPERTY_VOCABULARY_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/object-keys.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theLocalValueSetRuleOnTheObjectKeyReader", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(PROPERTY_VOCABULARY_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/object-keys.ts", ...LINT_TAIL], settings);
        return linted.stdout.includes(NO_LOCAL_CODE);
      })
      .extend("theUnregisteredRouteComplaintOnTheObjectKeyReader", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(PROPERTY_VOCABULARY_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/object-keys.ts", ...LINT_TAIL], settings);
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return messagesIn(JSON.parse(linted.stdout))
          .join("\n")
          .includes("neither a registered public export path");
      });

    it("fails the lint", ({ theExitCodeOfLintingTheObjectKeyReader }) => {
      expect(theExitCodeOfLintingTheObjectKeyReader).toBe(1);
    });

    it("names the local-value-set rule", ({ theLocalValueSetRuleOnTheObjectKeyReader }) => {
      expect(theLocalValueSetRuleOnTheObjectKeyReader).toBe(true);
    });

    it("keeps the route identity across the module boundary", ({
      theUnregisteredRouteComplaintOnTheObjectKeyReader,
    }) => {
      expect(theUnregisteredRouteComplaintOnTheObjectKeyReader).toBe(true);
    });
  });

  describe("a cache left behind at the previous version with a poisoned entry", () => {
    const it = test
      .extend("theExitCodeOfLintingTheOwnerThatFillsTheCache", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(POISONED_CACHE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/owner.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theExitCodeOfLintingTheConsumerAgainstAPoisonedCache", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(POISONED_CACHE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        spawnSync("vp", ["lint", "src/owner.ts", ...LINT_TAIL], settings);
        const cachePath = join(root, CACHE_RELATIVE_PATH);
        const cached = JSON.parse(readFileSync(cachePath, "utf8")) as {
          readonly fingerprint: string;
        };
        const poisoned = JSON.stringify({
          version: 4,
          fingerprint: cached.fingerprint,
          entries: [POISON_CACHE_ENTRY],
        });
        writeFileSync(cachePath, poisoned, "utf8");
        const linted = spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theRealConceptReportedAgainstAPoisonedCache", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(POISONED_CACHE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        spawnSync("vp", ["lint", "src/owner.ts", ...LINT_TAIL], settings);
        const cachePath = join(root, CACHE_RELATIVE_PATH);
        const cached = JSON.parse(readFileSync(cachePath, "utf8")) as {
          readonly fingerprint: string;
        };
        const poisoned = JSON.stringify({
          version: 4,
          fingerprint: cached.fingerprint,
          entries: [POISON_CACHE_ENTRY],
        });
        writeFileSync(cachePath, poisoned, "utf8");
        const linted = spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return messagesIn(JSON.parse(linted.stdout)).join("\n").includes("real.status");
      })
      .extend("thePoisonedConceptReportedAgainstAPoisonedCache", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(POISONED_CACHE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        spawnSync("vp", ["lint", "src/owner.ts", ...LINT_TAIL], settings);
        const cachePath = join(root, CACHE_RELATIVE_PATH);
        const cached = JSON.parse(readFileSync(cachePath, "utf8")) as {
          readonly fingerprint: string;
        };
        const poisoned = JSON.stringify({
          version: 4,
          fingerprint: cached.fingerprint,
          entries: [POISON_CACHE_ENTRY],
        });
        writeFileSync(cachePath, poisoned, "utf8");
        const linted = spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return messagesIn(JSON.parse(linted.stdout)).join("\n").includes("poison.cache");
      })
      .extend("theCacheVersionWrittenBackOverAPoisonedCache", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(POISONED_CACHE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        spawnSync("vp", ["lint", "src/owner.ts", ...LINT_TAIL], settings);
        const cachePath = join(root, CACHE_RELATIVE_PATH);
        const cached = JSON.parse(readFileSync(cachePath, "utf8")) as {
          readonly fingerprint: string;
        };
        const poisoned = JSON.stringify({
          version: 4,
          fingerprint: cached.fingerprint,
          entries: [POISON_CACHE_ENTRY],
        });
        writeFileSync(cachePath, poisoned, "utf8");
        spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        const reloaded = JSON.parse(readFileSync(cachePath, "utf8")) as {
          readonly version: number;
        };
        return typeof reloaded.version === "number" ? reloaded.version : -1;
      })
      .extend("theConceptsHeldByTheCacheWrittenBack", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(POISONED_CACHE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        spawnSync("vp", ["lint", "src/owner.ts", ...LINT_TAIL], settings);
        const cachePath = join(root, CACHE_RELATIVE_PATH);
        const cached = JSON.parse(readFileSync(cachePath, "utf8")) as {
          readonly fingerprint: string;
        };
        const poisoned = JSON.stringify({
          version: 4,
          fingerprint: cached.fingerprint,
          entries: [POISON_CACHE_ENTRY],
        });
        writeFileSync(cachePath, poisoned, "utf8");
        spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        const reloaded = JSON.parse(readFileSync(cachePath, "utf8")) as {
          readonly entries: readonly { readonly conceptId: string }[];
        };
        return reloaded.entries.map((declared) => declared.conceptId);
      });

    it("passes the lint that fills the cache", ({
      theExitCodeOfLintingTheOwnerThatFillsTheCache,
    }) => {
      expect(theExitCodeOfLintingTheOwnerThatFillsTheCache).toBe(0);
    });

    it("fails the lint of the consumer", ({
      theExitCodeOfLintingTheConsumerAgainstAPoisonedCache,
    }) => {
      expect(theExitCodeOfLintingTheConsumerAgainstAPoisonedCache).toBe(1);
    });

    it("reports the concept the repository really declares", ({
      theRealConceptReportedAgainstAPoisonedCache,
    }) => {
      expect(theRealConceptReportedAgainstAPoisonedCache).toBe(true);
    });

    it("reports nothing from the discarded entry", ({
      thePoisonedConceptReportedAgainstAPoisonedCache,
    }) => {
      expect(thePoisonedConceptReportedAgainstAPoisonedCache).toBe(false);
    });

    it("writes the cache back at the current version", ({
      theCacheVersionWrittenBackOverAPoisonedCache,
    }) => {
      expect(theCacheVersionWrittenBackOverAPoisonedCache).toBe(5);
    });

    it("holds only the concept the repository declares", ({
      theConceptsHeldByTheCacheWrittenBack,
    }) => {
      expect(theConceptsHeldByTheCacheWrittenBack).toStrictEqual(["real.status"]);
    });
  });

  describe("owners declaring negative numbers, spreads, object keys and null", () => {
    const it = test
      .extend("theExitCodeOfVerifyingNegativeAndNullValues", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NEGATIVE_AND_NULL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return typeof checked.status === "number" ? checked.status : -1;
      })
      .extend("theStandardOutputOfVerifyingNegativeAndNullValuesIsEmpty", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NEGATIVE_AND_NULL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return checked.stdout === "";
      })
      .extend("theExitCodeOfLintingTheBaseOwner", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NEGATIVE_AND_NULL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/base.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theExitCodeOfLintingTheSpreadOwner", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NEGATIVE_AND_NULL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/retry.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theExitCodeOfLintingTheObjectKeyOwner", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NEGATIVE_AND_NULL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/order.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theExitCodeOfLintingTheConsumerOfNegativeAndNullValues", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NEGATIVE_AND_NULL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theSpreadConceptReportedOnTheConsumer", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NEGATIVE_AND_NULL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return messagesIn(JSON.parse(linted.stdout)).join("\n").includes("retry.outcome");
      })
      .extend("theObjectKeyConceptReportedOnTheConsumer", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NEGATIVE_AND_NULL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return messagesIn(JSON.parse(linted.stdout)).join("\n").includes("order.status");
      })
      .extend("theNegativeNumberReportedOnTheConsumer", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NEGATIVE_AND_NULL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return messagesIn(JSON.parse(linted.stdout)).join("\n").includes("-1");
      })
      .extend("theNullValueReportedOnTheConsumer", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NEGATIVE_AND_NULL_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/consumer.ts", ...LINT_TAIL], settings);
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return messagesIn(JSON.parse(linted.stdout)).join("\n").includes("null");
      });

    it("verifies the repository", ({ theExitCodeOfVerifyingNegativeAndNullValues }) => {
      expect(theExitCodeOfVerifyingNegativeAndNullValues).toBe(0);
    });

    it("stays silent on standard output", ({
      theStandardOutputOfVerifyingNegativeAndNullValuesIsEmpty,
    }) => {
      expect(theStandardOutputOfVerifyingNegativeAndNullValuesIsEmpty).toBe(true);
    });

    it("leaves the base owner unreported", ({ theExitCodeOfLintingTheBaseOwner }) => {
      expect(theExitCodeOfLintingTheBaseOwner).toBe(0);
    });

    it("leaves the spreading owner unreported", ({ theExitCodeOfLintingTheSpreadOwner }) => {
      expect(theExitCodeOfLintingTheSpreadOwner).toBe(0);
    });

    it("leaves the object-key owner unreported", ({ theExitCodeOfLintingTheObjectKeyOwner }) => {
      expect(theExitCodeOfLintingTheObjectKeyOwner).toBe(0);
    });

    it("fails the lint of the consumer", ({
      theExitCodeOfLintingTheConsumerOfNegativeAndNullValues,
    }) => {
      expect(theExitCodeOfLintingTheConsumerOfNegativeAndNullValues).toBe(1);
    });

    it("names the spread concept on the consumer", ({ theSpreadConceptReportedOnTheConsumer }) => {
      expect(theSpreadConceptReportedOnTheConsumer).toBe(true);
    });

    it("names the object-key concept on the consumer", ({
      theObjectKeyConceptReportedOnTheConsumer,
    }) => {
      expect(theObjectKeyConceptReportedOnTheConsumer).toBe(true);
    });

    it("names the negative number on the consumer", ({
      theNegativeNumberReportedOnTheConsumer,
    }) => {
      expect(theNegativeNumberReportedOnTheConsumer).toBe(true);
    });

    it("names the null value on the consumer", ({ theNullValueReportedOnTheConsumer }) => {
      expect(theNullValueReportedOnTheConsumer).toBe(true);
    });
  });

  describe("an owner whose single value carries a NUL beside a two-value owner", () => {
    const it = test
      .extend("theExitCodeOfVerifyingANulBearingValue", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NUL_BEARING_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return typeof checked.status === "number" ? checked.status : -1;
      })
      .extend("theStandardOutputOfVerifyingANulBearingValueIsEmpty", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(NUL_BEARING_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return checked.stdout === "";
      });

    it("keeps the two fingerprints apart", ({ theExitCodeOfVerifyingANulBearingValue }) => {
      expect(theExitCodeOfVerifyingANulBearingValue).toBe(0);
    });

    it("stays silent on standard output", ({
      theStandardOutputOfVerifyingANulBearingValueIsEmpty,
    }) => {
      expect(theStandardOutputOfVerifyingANulBearingValueIsEmpty).toBe(true);
    });
  });

  describe("two declarations of one concept written on the same line", () => {
    const it = test
      .extend("theExitCodeOfVerifyingSameLineDuplicates", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(SAME_LINE_DUPLICATE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return typeof checked.status === "number" ? checked.status : -1;
      })
      .extend("theAlreadyDeclaredSiteReportedForSameLineDuplicates", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(SAME_LINE_DUPLICATE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const checked = spawnSync(process.execPath, [...CHECK_ARGUMENTS, root], settings);
        return checked.stdout.includes("already declared at src/duplicate.ts:1");
      })
      .extend("theExitCodeOfLintingSameLineDuplicates", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(SAME_LINE_DUPLICATE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/duplicate.ts", ...LINT_TAIL], settings);
        return typeof linted.status === "number" ? linted.status : -1;
      })
      .extend("theLocalValueSetRuleOnSameLineDuplicates", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(SAME_LINE_DUPLICATE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/duplicate.ts", ...LINT_TAIL], settings);
        return linted.stdout.includes(NO_LOCAL_CODE);
      })
      .extend("theDuplicatedConceptReportedOnSameLineDuplicates", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(SAME_LINE_DUPLICATE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const settings = { ...SPAWN_SETTINGS, cwd: root };
        const linted = spawnSync("vp", ["lint", "src/duplicate.ts", ...LINT_TAIL], settings);
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return messagesIn(JSON.parse(linted.stdout)).join("\n").includes("order.status");
      });

    it("fails verification", ({ theExitCodeOfVerifyingSameLineDuplicates }) => {
      expect(theExitCodeOfVerifyingSameLineDuplicates).toBe(1);
    });

    it("names the line the concept was first declared on", ({
      theAlreadyDeclaredSiteReportedForSameLineDuplicates,
    }) => {
      expect(theAlreadyDeclaredSiteReportedForSameLineDuplicates).toBe(true);
    });

    it("fails the lint of the duplicating file", ({ theExitCodeOfLintingSameLineDuplicates }) => {
      expect(theExitCodeOfLintingSameLineDuplicates).toBe(1);
    });

    it("names the local-value-set rule", ({ theLocalValueSetRuleOnSameLineDuplicates }) => {
      expect(theLocalValueSetRuleOnSameLineDuplicates).toBe(true);
    });

    it("leaves the concept without a catalog owner", ({
      theDuplicatedConceptReportedOnSameLineDuplicates,
    }) => {
      expect(theDuplicatedConceptReportedOnSameLineDuplicates).toBe(false);
    });
  });
});
