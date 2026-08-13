import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as ts from "typescript-6";
import { describe, expect, test } from "vite-plus/test";

import {
  canonicalValuesTypeScriptConfigPath,
  createCanonicalValuesTypeScriptProgram,
} from "./typescript-program.ts";

const repository = (): string => {
  const root = mkdtempSync(join(tmpdir(), "canonical-values-typescript-program-"));
  mkdirSync(join(root, "src"), { recursive: true });
  return root;
};

const write = (input: {
  readonly contents: string;
  readonly path: string;
  readonly root: string;
}): string => {
  const absolutePath = join(input.root, input.path);
  mkdirSync(join(absolutePath, ".."), { recursive: true });
  writeFileSync(absolutePath, input.contents);
  return absolutePath;
};

const bindingType = (program: ts.Program, ownerPath: string): string => {
  const source = program.getSourceFile(ownerPath);
  const statement = source?.statements[1];
  if (statement === undefined || !ts.isVariableStatement(statement)) return "missing";
  const declaration = statement.declarationList.declarations[0];
  if (declaration === undefined) return "missing";
  return program
    .getTypeChecker()
    .typeToString(program.getTypeChecker().getTypeAtLocation(declaration.name));
};

describe("createCanonicalValuesTypeScriptProgram", () => {
  test("uses one configuration identity for sibling source directories", () => {
    const root = repository();
    const configPath = write({ root, path: "tsconfig.json", contents: "{}" });

    expect(
      ["src/first", "src/second"].map((searchDirectory) =>
        canonicalValuesTypeScriptConfigPath({
          repositoryRoot: root,
          searchDirectory: join(root, searchDirectory),
        }),
      ),
    ).toStrictEqual([configPath, configPath]);
    rmSync(root, { force: true, recursive: true });
  });

  test("keeps nested TypeScript configurations as distinct program identities", () => {
    const root = repository();
    const rootConfig = write({ root, path: "tsconfig.json", contents: "{}" });
    const nestedConfig = write({ root, path: "packages/nested/tsconfig.json", contents: "{}" });

    expect(
      ["src", "packages/nested/src"].map((searchDirectory) =>
        canonicalValuesTypeScriptConfigPath({
          repositoryRoot: root,
          searchDirectory: join(root, searchDirectory),
        }),
      ),
    ).toStrictEqual([rootConfig, nestedConfig]);
    rmSync(root, { force: true, recursive: true });
  });

  test("uses the nearest repository tsconfig paths mapping", () => {
    const root = repository();
    write({
      root,
      path: "tsconfig.json",
      contents: JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@internal/base": ["src/base.ts"] } },
      }),
    });
    write({ root, path: "src/base.ts", contents: 'export const BASE = ["draft"] as const;\n' });
    const ownerPath = write({
      root,
      path: "src/owner.ts",
      contents:
        'import { BASE } from "@internal/base";\nexport const OWNER = [...BASE, "published"] as const;\n',
    });
    const program = createCanonicalValuesTypeScriptProgram({
      repositoryRoot: root,
      rootNames: [ownerPath],
      searchDirectory: join(root, "src"),
    });

    expect(bindingType(program, ownerPath)).toBe('readonly ["draft", "published"]');
    rmSync(root, { force: true, recursive: true });
  });

  test("does not load a tsconfig above the repository root", () => {
    const outer = repository();
    const root = join(outer, "nested");
    mkdirSync(join(root, "src"), { recursive: true });
    write({
      root: outer,
      path: "tsconfig.json",
      contents: JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@internal/base": ["base.ts"] } },
      }),
    });
    write({ root: outer, path: "base.ts", contents: 'export const BASE = ["draft"] as const;\n' });
    const ownerPath = write({
      root,
      path: "src/owner.ts",
      contents:
        'import { BASE } from "@internal/base";\nexport const OWNER = [...BASE, "published"] as const;\n',
    });
    const program = createCanonicalValuesTypeScriptProgram({
      repositoryRoot: root,
      rootNames: [ownerPath],
      searchDirectory: join(root, "src"),
    });

    expect(bindingType(program, ownerPath)).toBe('readonly [...any[], "published"]');
    rmSync(outer, { force: true, recursive: true });
  });

  test("rejects a config that extends an arbitrary file outside the repository", () => {
    const outer = repository();
    const root = join(outer, "nested");
    mkdirSync(join(root, "src"), { recursive: true });
    write({ root: outer, path: "base.json", contents: JSON.stringify({ compilerOptions: {} }) });
    write({ root, path: "tsconfig.json", contents: JSON.stringify({ extends: "../base.json" }) });
    const ownerPath = write({
      root,
      path: "src/owner.ts",
      contents: 'export const OWNER = ["draft", "published"] as const;\n',
    });

    expect(() =>
      createCanonicalValuesTypeScriptProgram({
        repositoryRoot: root,
        rootNames: [ownerPath],
        searchDirectory: join(root, "src"),
      }),
    ).toThrow("TypeScript config extends outside the repository");
    rmSync(outer, { force: true, recursive: true });
  });

  test("rejects a paths target outside the cache-bounded repository", () => {
    const outer = repository();
    const root = join(outer, "nested");
    mkdirSync(join(root, "src"), { recursive: true });
    write({ root: outer, path: "base.ts", contents: 'export const BASE = ["draft"] as const;\n' });
    write({
      root,
      path: "tsconfig.json",
      contents: JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@external/base": ["../base.ts"] } },
      }),
    });
    const ownerPath = write({
      root,
      path: "src/owner.ts",
      contents:
        'import { BASE } from "@external/base";\nexport const OWNER = [...BASE, "published"] as const;\n',
    });

    expect(() =>
      createCanonicalValuesTypeScriptProgram({
        repositoryRoot: root,
        rootNames: [ownerPath],
        searchDirectory: join(root, "src"),
      }),
    ).toThrow("TypeScript dependency is outside the repository");
    rmSync(outer, { force: true, recursive: true });
  });

  test("reports the first malformed TypeScript configuration diagnostic", () => {
    const root = repository();
    write({ root, path: "tsconfig.json", contents: '{ "compilerOptions": { "module": 1 }' });
    const ownerPath = write({
      root,
      path: "src/owner.ts",
      contents: 'export const OWNER = ["draft", "published"] as const;\n',
    });

    expect(() =>
      createCanonicalValuesTypeScriptProgram({
        repositoryRoot: root,
        rootNames: [ownerPath],
        searchDirectory: join(root, "src"),
      }),
    ).toThrow("Compiler option 'module' requires a value of type string.");
    rmSync(root, { force: true, recursive: true });
  });

  test.each([
    {
      extension: "tsx",
      languageVariant: ts.LanguageVariant.JSX,
      source: "export const view = <main />;\n",
    },
    {
      extension: "ts",
      languageVariant: ts.LanguageVariant.Standard,
      source: "export const value = 1;\n",
    },
  ] as const)(
    "parses a $extension source override with its script kind",
    ({ extension, languageVariant, source }) => {
      const root = repository();
      const sourcePath = join(root, `src/owner.${extension}`);
      const program = createCanonicalValuesTypeScriptProgram({
        repositoryRoot: root,
        rootNames: [sourcePath],
        searchDirectory: join(root, "src"),
        sourceOverrides: new Map([[sourcePath, source]]),
      });

      expect(program.getSourceFile(sourcePath)?.languageVariant).toBe(languageVariant);
      rmSync(root, { force: true, recursive: true });
    },
  );
});
