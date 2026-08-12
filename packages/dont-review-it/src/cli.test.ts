import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { fingerprintValues } from "./lint/oxlint/lib/canonical-values/fingerprint.ts";

const NO_LOCAL_RULE = "dont-review-it/no-local-finite-value-set--use-or-register-canonical-values";

const NO_STRICT_RULE = "dont-review-it/no-strict-canonical-literal-use--use-canonical-import";

const NO_LOCAL_CODE = NO_LOCAL_RULE.replace("/", "(") + ")";

const NO_STRICT_CODE = NO_STRICT_RULE.replace("/", "(") + ")";

const CLI_PATH = fileURLToPath(new URL("./cli.ts", import.meta.url));

const PLUGIN_PATH = fileURLToPath(new URL("./plugin.ts", import.meta.url));

const PROCESS_TIMEOUT = 180_000;

type CommandResult = {
  readonly exitCode: number | null;
  readonly out: string;
  readonly error: string;
};

const writeRepositoryFile = (
  root: string,
  {
    relativePath,
    contents: fileText,
  }: { readonly relativePath: string; readonly contents: string },
): void => {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, fileText, "utf8");
};

const lintConfigSource = (): string =>
  `export default ${JSON.stringify({
    lint: {
      categories: { correctness: "off" },
      plugins: [],
      jsPlugins: [{ name: "dont-review-it", specifier: PLUGIN_PATH }],
      rules: { [NO_LOCAL_RULE]: "error", [NO_STRICT_RULE]: "error" },
    },
  })};\n`;

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  writeRepositoryFile(root, {
    relativePath: "package.json",
    contents: JSON.stringify({
      name: "canonical-values-e2e",
      private: true,
      scripts: { guard: "throttle --timeout 1800 -- spool -- vp check" },
      type: "module",
      workspaces: [],
    }),
  });
  writeRepositoryFile(root, { relativePath: "vite.config.ts", contents: lintConfigSource() });
  for (const [relativePath, fileText] of Object.entries(files)) {
    writeRepositoryFile(root, { relativePath, contents: fileText });
  }
  return root;
};

const runCommand = ({
  command,
  arguments_,
  cwd,
}: {
  readonly command: string;
  readonly arguments_: readonly string[];
  readonly cwd: string;
}): CommandResult => {
  const run = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    timeout: PROCESS_TIMEOUT,
  });
  if (run.error !== undefined) throw run.error;
  return { exitCode: run.status, out: run.stdout, error: run.stderr };
};

const runCli = (root: string): CommandResult =>
  runCommand({
    command: process.execPath,
    arguments_: [CLI_PATH, "check", "--repository-root", root],
    cwd: root,
  });

const runLint = (root: string, relativePath: string): CommandResult =>
  runCommand({
    command: "vp",
    arguments_: ["lint", relativePath, "--format", "json", "--threads", "1"],
    cwd: root,
  });

const messagesIn = (jsonNode: unknown): readonly string[] => {
  if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
  if (jsonNode === null || typeof jsonNode !== "object") return [];
  return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
    fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
  );
};

const lintMessages = (run: CommandResult): string => messagesIn(JSON.parse(run.out)).join("\n");

const annotated = (conceptId: string, declaration: string): string =>
  `/** @canonical-values ${conceptId} */\n${declaration}\n`;

const validOwner = (statusName: string): string =>
  annotated(
    "real.status",
    `export const REAL_STATUSES = [${JSON.stringify(statusName)}] as const;`,
  );

describe("canonical values process e2e", { timeout: PROCESS_TIMEOUT * 4 }, () => {
  test("a canonical owner verifies and its consumer raw literal is linted", () => {
    const root = repositoryWith({
      "src/consumer.ts": 'export const selected = "draft";\n',
      "src/owner.ts": validOwner("draft"),
    });

    const verified = runCli(root);
    expect(verified).toMatchObject({ exitCode: 0, out: "" });
    expect(verified.error).toContain("checked canonical-values");
    expect(runLint(root, "src/owner.ts")).toMatchObject({ exitCode: 0 });
    const consumer = runLint(root, "src/consumer.ts");
    expect(consumer.exitCode).toBe(1);
    expect(consumer.out).toContain(NO_STRICT_CODE);
  });

  test("a top-level if annotation fails verification and grants no lint exemption", () => {
    const root = repositoryWith({
      "src/invalid.ts": '/** @canonical-values fake.if */\nif (true) consume("draft");\n',
      "src/owner.ts": validOwner("draft"),
    });

    const verified = runCli(root);
    expect(verified.exitCode).toBe(1);
    expect(verified.out).toContain("src/invalid.ts:1");
    const linted = runLint(root, "src/invalid.ts");
    expect(linted.exitCode).toBe(1);
    expect(linted.out).toContain(NO_STRICT_CODE);
  });

  test("a nested annotation cannot turn its following bait into an exempt owner", () => {
    const root = repositoryWith({
      "src/invalid.ts":
        'export function load() {\n  /** @canonical-values fake.nested */\n  return "other";\n}\nexport const BAIT = ["published"] as const;\n',
      "src/owner.ts": validOwner("published"),
    });

    const verified = runCli(root);
    expect(verified.exitCode).toBe(1);
    expect(verified.out).toContain("src/invalid.ts:2");
    const linted = runLint(root, "src/invalid.ts");
    expect(linted.exitCode).toBe(1);
    expect(linted.out).toContain(NO_STRICT_CODE);
  });

  test("story and fixture annotations remain strict problems outside the production catalog", () => {
    const root = repositoryWith({
      "fixtures/status.ts": annotated(
        "real.status",
        'export const FIXTURE_STATUSES = ["draft"] as const;',
      ),
      "src/Owner.stories.ts": annotated(
        "real.status",
        'export const STORY_STATUSES = ["draft"] as const;',
      ),
      "src/consumer.ts": 'export const selected = "draft";\n',
      "src/owner.ts": validOwner("draft"),
    });

    const verified = runCli(root);
    expect(verified.exitCode).toBe(1);
    expect(verified.out).toContain("fixtures/status.ts:1");
    expect(verified.out).toContain("src/Owner.stories.ts:1");
    expect(verified.out).not.toContain("already declared");
    const consumer = runLint(root, "src/consumer.ts");
    expect(consumer.exitCode).toBe(1);
    expect(lintMessages(consumer)).toContain("real.status");
  });

  test("an annotated re-export fails verification and grants no range exemption", () => {
    const root = repositoryWith({
      "src/invalid.ts":
        '/** @canonical-values fake.re-export */\nexport { VALUES } from "./values.ts";\nexport const fallback = "draft";\n',
      "src/owner.ts": validOwner("draft"),
      "src/values.ts": 'export const VALUES = ["other"] as const;\n',
    });

    const verified = runCli(root);
    expect(verified.exitCode).toBe(1);
    expect(verified.out).toContain("src/invalid.ts:1");
    const linted = runLint(root, "src/invalid.ts");
    expect(linted.exitCode).toBe(1);
    expect(linted.out).toContain(NO_STRICT_CODE);
  });

  test("a package shadow subpath is an unregistered canonical import route", () => {
    const root = packageRouteRepository();

    const verified = runCli(root);
    expect(verified).toMatchObject({ exitCode: 0, out: "" });
    expect(verified.error).toContain("checked canonical-values");
    const linted = runLint(root, "src/shadow-consumer.ts");
    expect(linted.exitCode).toBe(1);
    expect(linted.out).toContain(NO_LOCAL_CODE);
    expect(lintMessages(linted)).toContain("neither a registered public export path");
  });

  test("an alias subpath that exports the owner symbol is a registered route", () => {
    const root = packageRouteRepository();

    const verified = runCli(root);
    expect(verified).toMatchObject({ exitCode: 0, out: "" });
    expect(verified.error).toContain("checked canonical-values");
    expect(runLint(root, "src/alias-consumer.ts")).toMatchObject({ exitCode: 0 });
  });

  test("an ambient global with an owner binding name is not a registered route", () => {
    const root = packageRouteRepository();
    writeRepositoryFile(root, {
      relativePath: "src/globals.d.ts",
      contents: 'declare const ORDER_STATUSES: readonly ["shadow", "values"];\n',
    });
    writeRepositoryFile(root, {
      relativePath: "src/global-consumer.ts",
      contents: "export const schema = z.enum(ORDER_STATUSES);\n",
    });

    const linted = runLint(root, "src/global-consumer.ts");
    expect(linted.exitCode).toBe(1);
    expect(linted.out).toContain(NO_LOCAL_CODE);
    expect(lintMessages(linted)).toContain("neither a registered public export path");
  });

  test("property vocabularies keep repository route identity across module boundaries", () => {
    const root = repositoryWith({
      "src/import-type.ts": 'export type Status = keyof import("./shape.ts").Shape;\n',
      "src/object-keys.ts":
        'import { SHAPE } from "./shape.ts";\nexport const schema = z.enum(Object.keys(SHAPE));\n',
      "src/shape.ts":
        "export interface Shape { draft: 0; published: 1 }\nexport const SHAPE = { draft: 0, published: 1 };\n",
      "src/type-import.ts":
        'import type { Shape } from "./shape.ts";\nexport type Status = keyof Shape;\n',
    });

    for (const relativePath of ["src/type-import.ts", "src/import-type.ts", "src/object-keys.ts"]) {
      const linted = runLint(root, relativePath);
      expect(linted.exitCode).toBe(1);
      expect(linted.out).toContain(NO_LOCAL_CODE);
      expect(lintMessages(linted)).toContain("neither a registered public export path");
    }
  });

  test("a version 4 poison cache is discarded by a separate lint process", () => {
    const root = repositoryWith({
      "src/consumer.ts": 'export const poison = "poison";\nexport const actual = "draft";\n',
      "src/owner.ts": validOwner("draft"),
    });
    expect(runLint(root, "src/owner.ts").exitCode).toBe(0);
    const cachePath = join(
      root,
      "node_modules",
      ".cache",
      "mst-dont-review-it",
      "canonical-values.json",
    );
    const cached = JSON.parse(readFileSync(cachePath, "utf8")) as { readonly fingerprint: string };
    writeFileSync(
      cachePath,
      JSON.stringify({
        version: 4,
        fingerprint: cached.fingerprint,
        entries: [poisonEntry()],
      }),
      "utf8",
    );

    const linted = runLint(root, "src/consumer.ts");
    expect(linted.exitCode).toBe(1);
    expect(lintMessages(linted)).toContain("real.status");
    expect(lintMessages(linted)).not.toContain("poison.cache");
    expect(JSON.parse(readFileSync(cachePath, "utf8"))).toMatchObject({
      version: 5,
      entries: [{ conceptId: "real.status" }],
    });
  });

  test("negative spread values, object keys, and null reach the real plugin catalog", () => {
    const root = repositoryWith({
      "src/base.ts": annotated("retry.base", "export const BASE = [-1, null] as const;"),
      "src/consumer.ts": 'export const observed = [-1, null, 1, "draft", "published"] as const;\n',
      "src/order.ts": annotated(
        "order.status",
        'export const ORDER_STATUS = { draft: { label: "Draft" }, published: { label: "Published" } } as const;',
      ),
      "src/retry.ts":
        'import { BASE } from "./base.ts";\n' +
        annotated("retry.outcome", "export const OUTCOMES = [...BASE, 1] as const;"),
    });

    expect(runCli(root)).toMatchObject({ exitCode: 0, out: "" });
    expect(runLint(root, "src/base.ts").exitCode).toBe(0);
    expect(runLint(root, "src/retry.ts").exitCode).toBe(0);
    expect(runLint(root, "src/order.ts").exitCode).toBe(0);
    const consumer = runLint(root, "src/consumer.ts");
    expect(consumer.exitCode).toBe(1);
    const lintMessageText = lintMessages(consumer);
    expect(lintMessageText).toContain("retry.outcome");
    expect(lintMessageText).toContain("order.status");
    expect(lintMessageText).toContain("-1");
    expect(lintMessageText).toContain("null");
  });

  test("a NUL-bearing value cannot collide with a two-value fingerprint", () => {
    const root = repositoryWith({
      "src/joined.ts": annotated(
        "joined.value",
        'export const JOINED = ["a\\0string:b"] as const;',
      ),
      "src/pair.ts": annotated("pair.value", 'export const PAIR = ["a", "b"] as const;'),
    });

    expect(runCli(root)).toMatchObject({ exitCode: 0, out: "" });
  });

  test("same-line duplicate declarations fail verification and leave no catalog owner", () => {
    const root = repositoryWith({
      "src/duplicate.ts":
        '/** @canonical-values order.status */ const A = ["draft"] as const; /** @canonical-values order.status */ const B = ["published"] as const;\nexport type Status = "draft" | "published";\n',
    });

    const verified = runCli(root);
    expect(verified.exitCode).toBe(1);
    expect(verified.out).toContain("already declared at src/duplicate.ts:1");
    const linted = runLint(root, "src/duplicate.ts");
    expect(linted.exitCode).toBe(1);
    expect(linted.out).toContain(NO_LOCAL_CODE);
    expect(lintMessages(linted)).not.toContain("order.status");
  });
});

const packageRouteRepository = (): string =>
  repositoryWith({
    "package.json": JSON.stringify({
      name: "canonical-values-e2e",
      private: true,
      scripts: { guard: "throttle --timeout 1800 -- spool -- vp check" },
      type: "module",
      workspaces: ["packages/*"],
    }),
    "packages/vocabulary/package.json": JSON.stringify({
      name: "@fixture/vocabulary",
      private: true,
      exports: {
        ".": "./src/index.ts",
        "./alias": "./src/alias.ts",
        "./shadow": "./src/shadow.ts",
      },
    }),
    "packages/vocabulary/src/alias.ts":
      'export { ORDER_STATUSES as PUBLIC_STATUSES } from "./owner.ts";\n',
    "packages/vocabulary/src/index.ts": 'export { ORDER_STATUSES } from "./owner.ts";\n',
    "packages/vocabulary/src/owner.ts": annotated(
      "order.status",
      'export const ORDER_STATUSES = ["draft", "published"] as const;',
    ),
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
  });

const poisonEntry = () => ({
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
});
