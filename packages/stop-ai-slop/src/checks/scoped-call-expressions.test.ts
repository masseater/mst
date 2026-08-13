import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { runStopAiSlop } from "../run-cli.ts";
import { scopedCallExpressionsIn } from "./scoped-call-expressions.ts";

describe("scopedCallExpressionsIn", () => {
  describe("a program of held declarations and destructuring patterns", () => {
    const it = test.extend("programScopeBindings", () => {
      const source = `
        export const { property: assigned = true, ...objectRest } = sourceObject;
        export const [arrayValue, ...arrayRest] = sourceArray;
        export default function exportedFunction() {}
        class DeclaredClass {}
        export { DeclaredClass };
        enum DeclaredEnum { Value }
        namespace DeclaredNamespace {}
        import importedValue = Other.value;
        target();
      `;
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
        ({ localBindings }) => [...localBindings],
      );
    });

    it("collects held declarations and destructured bindings in a program", ({
      programScopeBindings,
    }) => {
      expect(programScopeBindings).toStrictEqual([
        "assigned",
        "objectRest",
        "arrayValue",
        "arrayRest",
        "exportedFunction",
        "DeclaredClass",
        "DeclaredEnum",
        "DeclaredNamespace",
        "importedValue",
      ]);
    });
  });

  describe("catch, loop, switch, class, and named function scopes around the same call", () => {
    const it = test.extend("targetCallBindings", () => {
      const source = [
        "function namedFunction({ value: functionBinding }) { target(); }",
        "const namedExpression = function innerName() { target(); };",
        "try {} catch (caught) { target(); }",
        "for (let initialized = 0; initialized < 1; initialized += 1) { target(); }",
        "for (const forOfBinding of []) { target(); }",
        "for (const forInBinding in {}) { target(); }",
        "switch (true) { case true: const switched = true; target(); }",
        "const NamedClass = class InnerClass { method() { target(); } };",
      ].join("\n");
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program)
        .filter(({ call }) => call.callee.type === "Identifier" && call.callee.name === "target")
        .map(({ localBindings }) => [...localBindings]);
    });

    it("tracks catch, loop, switch, class, and named function scopes", ({ targetCallBindings }) => {
      expect(targetCallBindings).toStrictEqual([
        ["namedFunction", "namedExpression", "NamedClass", "functionBinding"],
        ["namedFunction", "namedExpression", "NamedClass", "innerName"],
        ["namedFunction", "namedExpression", "NamedClass", "caught"],
        ["namedFunction", "namedExpression", "NamedClass", "initialized"],
        ["namedFunction", "namedExpression", "NamedClass", "forOfBinding"],
        ["namedFunction", "namedExpression", "NamedClass", "forInBinding"],
        ["namedFunction", "namedExpression", "NamedClass", "switched"],
        ["namedFunction", "namedExpression", "NamedClass", "InnerClass"],
      ]);
    });
  });

  describe("a var declared under a branch inside a class static block", () => {
    const it = test.extend("staticBlockExpectBindingStates", () => {
      const source =
        "class Probe { static { if (true) { var expect = (value: boolean) => held; } expect(true); } }";
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
        ({ call, localBindings }) =>
          call.callee.type === "Identifier" && call.callee.name === "expect"
            ? [localBindings.has("expect")]
            : [],
      );
    });

    it("hoists var bindings inside a class static block", ({ staticBlockExpectBindingStates }) => {
      expect(staticBlockExpectBindingStates).toStrictEqual([true]);
    });
  });

  describe("a var declared under a branch inside a TypeScript module block", () => {
    const it = test.extend("moduleBlockExpectBindingStates", () => {
      const source =
        "namespace Probe { if (true) { var expect = (value: boolean) => held; } expect(true); }";
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
        ({ call, localBindings }) =>
          call.callee.type === "Identifier" && call.callee.name === "expect"
            ? [localBindings.has("expect")]
            : [],
      );
    });

    it("hoists var bindings inside a TypeScript module block", ({
      moduleBlockExpectBindingStates,
    }) => {
      expect(moduleBlockExpectBindingStates).toStrictEqual([true]);
    });
  });

  describe("a static block var beside a call in the containing function", () => {
    const it = test.extend("containingFunctionExpectBindingStates", () => {
      const source =
        "const run = () => { class Probe { static { var expect = true; } } expect(true); };";
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
        ({ call, localBindings }) =>
          call.callee.type === "Identifier" && call.callee.name === "expect"
            ? [localBindings.has("expect")]
            : [],
      );
    });

    it("does not leak a static block var into its containing function", ({
      containingFunctionExpectBindingStates,
    }) => {
      expect(containingFunctionExpectBindingStates).toStrictEqual([false]);
    });
  });

  describe("an imported assertion beside a binding of the same name in another lexical scope", () => {
    const it = test.extend("otherLexicalScopeReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const legacy = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      unlinkSync(join(repositoryRoot, "src/legacy.ts"));
      writeFileSync(
        join(repositoryRoot, "src/repository.test.ts"),
        'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\nconst helper = (expect: boolean) => expect;\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("does not let a binding in another lexical scope hide an imported assertion", ({
      otherLexicalScopeReport,
    }) => {
      expect(otherLexicalScopeReport).toStrictEqual({
        exitCode: 1,
        out: 'src/repository.test.ts:7 no-removal-verification: Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  describe("an imported assertion shadowed by a test callback parameter", () => {
    const it = test.extend("shadowingParameterReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const legacy = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      unlinkSync(join(repositoryRoot, "src/legacy.ts"));
      writeFileSync(
        join(repositoryRoot, "src/repository.test.ts"),
        'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", (expect) => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("does not resolve an imported assertion through a shadowing parameter", ({
      shadowingParameterReport,
    }) => {
      expect(shadowingParameterReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("an imported assertion shadowed by a class static block binding", () => {
    const it = test.extend("staticBlockBindingReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const legacy = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      unlinkSync(join(repositoryRoot, "src/legacy.ts"));
      writeFileSync(
        join(repositoryRoot, "src/repository.test.ts"),
        'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  static {\n    const expect = (value: boolean) => ({ toBe: (expected: boolean) => held === expected });\n    expect(existsSync("src/legacy.ts")).toBe(false);\n  }\n}\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("does not resolve an imported assertion through a static block binding", ({
      staticBlockBindingReport,
    }) => {
      expect(staticBlockBindingReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("an imported assertion shadowed by a TypeScript module binding", () => {
    const it = test.extend("moduleBindingReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const legacy = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      unlinkSync(join(repositoryRoot, "src/legacy.ts"));
      writeFileSync(
        join(repositoryRoot, "src/repository.test.ts"),
        'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  const expect = (value: boolean) => ({ toBe: (expected: boolean) => held === expected });\n  expect(existsSync("src/legacy.ts")).toBe(false);\n}\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("does not resolve an imported assertion through a TypeScript module binding", ({
      moduleBindingReport,
    }) => {
      expect(moduleBindingReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("a static block var beside an imported assertion in the enclosing test", () => {
    const it = test.extend("staticBlockVarReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const legacy = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      unlinkSync(join(repositoryRoot, "src/legacy.ts"));
      writeFileSync(
        join(repositoryRoot, "src/repository.test.ts"),
        'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  class Probe {\n    static {\n      var expect = true;\n    }\n  }\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("does not let a static block var hide an outer imported assertion", ({
      staticBlockVarReport,
    }) => {
      expect(staticBlockVarReport).toStrictEqual({
        exitCode: 1,
        out: 'src/repository.test.ts:10 no-removal-verification: Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  describe("an imported assertion shadowed by a constructor parameter property", () => {
    const it = test.extend("parameterPropertyReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const legacy = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      unlinkSync(join(repositoryRoot, "src/legacy.ts"));
      writeFileSync(
        join(repositoryRoot, "src/repository.test.ts"),
        'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  constructor(private expect: (value: boolean) => { toBe(expected: boolean): boolean }) {\n    expect(existsSync("src/legacy.ts")).toBe(false);\n  }\n}\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("does not resolve an imported assertion through a parameter property", ({
      parameterPropertyReport,
    }) => {
      expect(parameterPropertyReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("a namespace import shadowed by a constructor parameter property", () => {
    const it = test.extend("namespaceParameterPropertyReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/legacy.ts"),
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const current = true;\n");
      writeFileSync(
        join(repositoryRoot, "src/legacy-api.test.ts"),
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  constructor(private legacy: object) {\n    expect(legacy).not.toHaveProperty("legacyMode");\n  }\n}\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("does not resolve a namespace import through a parameter property", ({
      namespaceParameterPropertyReport,
    }) => {
      expect(namespaceParameterPropertyReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("a namespace import shadowed by a local enum", () => {
    const it = test.extend("localEnumReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/legacy.ts"),
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const current = true;\n");
      writeFileSync(
        join(repositoryRoot, "src/legacy-api.test.ts"),
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nfunction probe() {\n  enum legacy { current }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("does not resolve a namespace import through a local enum", ({ localEnumReport }) => {
      expect(localEnumReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("a namespace import shadowed by a local namespace", () => {
    const it = test.extend("localNamespaceReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/legacy.ts"),
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const current = true;\n");
      writeFileSync(
        join(repositoryRoot, "src/legacy-api.test.ts"),
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  export namespace legacy { export const current = true; }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("does not resolve a namespace import through a local namespace", ({
      localNamespaceReport,
    }) => {
      expect(localNamespaceReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("a namespace import shadowed by a qualified local namespace", () => {
    const it = test.extend("qualifiedNamespaceReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/legacy.ts"),
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const current = true;\n");
      writeFileSync(
        join(repositoryRoot, "src/legacy-api.test.ts"),
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  namespace legacy.inner { export const current = true; }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("does not resolve a namespace import through a qualified local namespace", ({
      qualifiedNamespaceReport,
    }) => {
      expect(qualifiedNamespaceReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("a namespace import beside a string-literal module declaration", () => {
    const it = test.extend("stringLiteralModuleReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/legacy.ts"),
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const current = true;\n");
      writeFileSync(
        join(repositoryRoot, "src/legacy-api.test.ts"),
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\ndeclare module "legacy" {}\nexpect(legacy).not.toHaveProperty("legacyMode");\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("keeps resolving a namespace import past a string-literal module declaration", ({
      stringLiteralModuleReport,
    }) => {
      expect(stringLiteralModuleReport).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  describe("a namespace import shadowed by an import-equals binding", () => {
    const it = test.extend("importEqualsReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/legacy.ts"),
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const current = true;\n");
      writeFileSync(
        join(repositoryRoot, "src/legacy-api.test.ts"),
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  import legacy = Other.legacy;\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("does not resolve a namespace import through an import-equals binding", ({
      importEqualsReport,
    }) => {
      expect(importEqualsReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("a namespace import beside a type-only declaration of the same name", () => {
    const it = test.extend("typeOnlyDeclarationReport", async () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "scoped-call-expressions-"));
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
            GIT_AUTHOR_NAME: "Scoped Call Expressions",
            GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
            GIT_COMMITTER_NAME: "Scoped Call Expressions",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/legacy.ts"),
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      writeFileSync(join(repositoryRoot, "src/legacy.ts"), "export const current = true;\n");
      writeFileSync(
        join(repositoryRoot, "src/legacy-api.test.ts"),
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nfunction probe() {\n  interface legacy {}\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
      );
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "snapshot"]);
      try {
        return await runStopAiSlop([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          "HEAD~1",
          "--head",
          "HEAD",
        ]);
      } finally {
        rmSync(repositoryRoot, { recursive: true, force: true });
      }
    });

    it("keeps resolving a namespace import past a type-only declaration", ({
      typeOnlyDeclarationReport,
    }) => {
      expect(typeOnlyDeclarationReport).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:6 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });
});
