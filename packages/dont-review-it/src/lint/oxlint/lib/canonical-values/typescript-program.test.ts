import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attempt } from "es-toolkit";
import * as ts from "typescript-6";
import { describe, expect, test } from "vite-plus/test";

import {
  canonicalValuesTypeScriptConfigPath,
  createCanonicalValuesTypeScriptProgram,
} from "./typescript-program.ts";

const BASE_SOURCE = 'export const BASE = ["draft"] as const;\n';
const OWNER_SOURCE =
  'import { BASE } from "@internal/base";\nexport const OWNER = [...BASE, "published"] as const;\n';

describe("createCanonicalValuesTypeScriptProgram", () => {
  describe("sibling source directories under one repository configuration", () => {
    const siblingRoot = join(tmpdir(), "canonical-values-typescript-program-sibling");

    const it = test.extend("siblingConfigPaths", ({}, { onCleanup }) => {
      rmSync(siblingRoot, { force: true, recursive: true });
      mkdirSync(join(siblingRoot, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(siblingRoot, { force: true, recursive: true });
      });
      writeFileSync(join(siblingRoot, "tsconfig.json"), "{}");
      return ["src/first", "src/second"].map((searchDirectory) =>
        canonicalValuesTypeScriptConfigPath({
          repositoryRoot: siblingRoot,
          searchDirectory: join(siblingRoot, searchDirectory),
        }),
      );
    });

    it("resolve to one configuration identity", ({ siblingConfigPaths }) => {
      expect(siblingConfigPaths).toStrictEqual([
        join(siblingRoot, "tsconfig.json"),
        join(siblingRoot, "tsconfig.json"),
      ]);
    });
  });

  describe("a nested configuration standing beside the repository configuration", () => {
    const nestedRoot = join(tmpdir(), "canonical-values-typescript-program-nested");

    const it = test.extend("nestedConfigPaths", ({}, { onCleanup }) => {
      rmSync(nestedRoot, { force: true, recursive: true });
      mkdirSync(join(nestedRoot, "src"), { recursive: true });
      mkdirSync(join(nestedRoot, "packages/nested/src"), { recursive: true });
      onCleanup(() => {
        rmSync(nestedRoot, { force: true, recursive: true });
      });
      writeFileSync(join(nestedRoot, "tsconfig.json"), "{}");
      writeFileSync(join(nestedRoot, "packages/nested/tsconfig.json"), "{}");
      return ["src", "packages/nested/src"].map((searchDirectory) =>
        canonicalValuesTypeScriptConfigPath({
          repositoryRoot: nestedRoot,
          searchDirectory: join(nestedRoot, searchDirectory),
        }),
      );
    });

    it("stay distinct program identities", ({ nestedConfigPaths }) => {
      expect(nestedConfigPaths).toStrictEqual([
        join(nestedRoot, "tsconfig.json"),
        join(nestedRoot, "packages/nested/tsconfig.json"),
      ]);
    });
  });

  describe("a paths mapping declared by the nearest repository configuration", () => {
    const mappingRoot = join(tmpdir(), "canonical-values-typescript-program-mapping");

    const it = test.extend("mappedOwnerType", ({}, { onCleanup }) => {
      rmSync(mappingRoot, { force: true, recursive: true });
      mkdirSync(join(mappingRoot, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(mappingRoot, { force: true, recursive: true });
      });
      writeFileSync(
        join(mappingRoot, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: { baseUrl: ".", paths: { "@internal/base": ["src/base.ts"] } },
        }),
      );
      writeFileSync(join(mappingRoot, "src/base.ts"), BASE_SOURCE);
      const ownerPath = join(mappingRoot, "src/owner.ts");
      writeFileSync(ownerPath, OWNER_SOURCE);
      const program = createCanonicalValuesTypeScriptProgram({
        repositoryRoot: mappingRoot,
        rootNames: [ownerPath],
        searchDirectory: join(mappingRoot, "src"),
      });
      const [, ownerStatement] = program.getSourceFile(ownerPath)?.statements ?? [];
      if (ownerStatement === undefined || !ts.isVariableStatement(ownerStatement)) {
        throw new Error("owner.ts did not parse into a variable statement");
      }
      const [ownerDeclaration] = ownerStatement.declarationList.declarations;
      if (ownerDeclaration === undefined) throw new Error("owner.ts declared no binding");
      return program
        .getTypeChecker()
        .typeToString(program.getTypeChecker().getTypeAtLocation(ownerDeclaration.name));
    });

    it("widens the owner to the mapped tuple", ({ mappedOwnerType }) => {
      expect(mappedOwnerType).toBe('readonly ["draft", "published"]');
    });
  });

  describe("a configuration sitting above the repository root", () => {
    const outsideConfigRoot = join(tmpdir(), "canonical-values-typescript-program-above");

    const it = test.extend("unmappedOwnerType", ({}, { onCleanup }) => {
      rmSync(outsideConfigRoot, { force: true, recursive: true });
      mkdirSync(join(outsideConfigRoot, "nested/src"), { recursive: true });
      onCleanup(() => {
        rmSync(outsideConfigRoot, { force: true, recursive: true });
      });
      writeFileSync(
        join(outsideConfigRoot, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: { baseUrl: ".", paths: { "@internal/base": ["base.ts"] } },
        }),
      );
      writeFileSync(join(outsideConfigRoot, "base.ts"), BASE_SOURCE);
      const ownerPath = join(outsideConfigRoot, "nested/src/owner.ts");
      writeFileSync(ownerPath, OWNER_SOURCE);
      const program = createCanonicalValuesTypeScriptProgram({
        repositoryRoot: join(outsideConfigRoot, "nested"),
        rootNames: [ownerPath],
        searchDirectory: join(outsideConfigRoot, "nested/src"),
      });
      const [, ownerStatement] = program.getSourceFile(ownerPath)?.statements ?? [];
      if (ownerStatement === undefined || !ts.isVariableStatement(ownerStatement)) {
        throw new Error("owner.ts did not parse into a variable statement");
      }
      const [ownerDeclaration] = ownerStatement.declarationList.declarations;
      if (ownerDeclaration === undefined) throw new Error("owner.ts declared no binding");
      return program
        .getTypeChecker()
        .typeToString(program.getTypeChecker().getTypeAtLocation(ownerDeclaration.name));
    });

    it("is left out of the program", ({ unmappedOwnerType }) => {
      expect(unmappedOwnerType).toBe('readonly [...any[], "published"]');
    });
  });

  describe("a configuration extending a file outside the repository", () => {
    const outsideExtendsRoot = join(tmpdir(), "canonical-values-typescript-program-extends");

    const it = test.extend("outsideExtendsFailure", ({}, { onCleanup }) => {
      rmSync(outsideExtendsRoot, { force: true, recursive: true });
      mkdirSync(join(outsideExtendsRoot, "nested/src"), { recursive: true });
      onCleanup(() => {
        rmSync(outsideExtendsRoot, { force: true, recursive: true });
      });
      writeFileSync(join(outsideExtendsRoot, "base.json"), JSON.stringify({ compilerOptions: {} }));
      writeFileSync(
        join(outsideExtendsRoot, "nested/tsconfig.json"),
        JSON.stringify({ extends: "../base.json" }),
      );
      const ownerPath = join(outsideExtendsRoot, "nested/src/owner.ts");
      writeFileSync(ownerPath, 'export const OWNER = ["draft", "published"] as const;\n');
      const [failure] = attempt<ts.Program, Error>(() =>
        createCanonicalValuesTypeScriptProgram({
          repositoryRoot: join(outsideExtendsRoot, "nested"),
          rootNames: [ownerPath],
          searchDirectory: join(outsideExtendsRoot, "nested/src"),
        }),
      );
      return failure === null ? null : failure.message;
    });

    it("is refused by name", ({ outsideExtendsFailure }) => {
      expect(outsideExtendsFailure).toBe(
        `TypeScript config extends outside the repository: ${join(outsideExtendsRoot, "base.json")}`,
      );
    });
  });

  describe("a paths target sitting outside the cache-bounded repository", () => {
    const outsideTargetRoot = join(tmpdir(), "canonical-values-typescript-program-target");

    const it = test.extend("outsideTargetFailure", ({}, { onCleanup }) => {
      rmSync(outsideTargetRoot, { force: true, recursive: true });
      mkdirSync(join(outsideTargetRoot, "nested/src"), { recursive: true });
      onCleanup(() => {
        rmSync(outsideTargetRoot, { force: true, recursive: true });
      });
      writeFileSync(join(outsideTargetRoot, "base.ts"), BASE_SOURCE);
      writeFileSync(
        join(outsideTargetRoot, "nested/tsconfig.json"),
        JSON.stringify({
          compilerOptions: { baseUrl: ".", paths: { "@external/base": ["../base.ts"] } },
        }),
      );
      const ownerPath = join(outsideTargetRoot, "nested/src/owner.ts");
      writeFileSync(
        ownerPath,
        'import { BASE } from "@external/base";\nexport const OWNER = [...BASE, "published"] as const;\n',
      );
      const [failure] = attempt<ts.Program, Error>(() =>
        createCanonicalValuesTypeScriptProgram({
          repositoryRoot: join(outsideTargetRoot, "nested"),
          rootNames: [ownerPath],
          searchDirectory: join(outsideTargetRoot, "nested/src"),
        }),
      );
      return failure === null ? null : failure.message;
    });

    it("is refused by name", ({ outsideTargetFailure }) => {
      expect(outsideTargetFailure).toBe(
        `TypeScript dependency is outside the repository: ${join(outsideTargetRoot, "base.ts")}`,
      );
    });
  });

  describe("a malformed TypeScript configuration", () => {
    const malformedRoot = join(tmpdir(), "canonical-values-typescript-program-malformed");

    const it = test.extend("malformedConfigFailure", ({}, { onCleanup }) => {
      rmSync(malformedRoot, { force: true, recursive: true });
      mkdirSync(join(malformedRoot, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(malformedRoot, { force: true, recursive: true });
      });
      writeFileSync(join(malformedRoot, "tsconfig.json"), '{ "compilerOptions": { "module": 1 }');
      const ownerPath = join(malformedRoot, "src/owner.ts");
      writeFileSync(ownerPath, 'export const OWNER = ["draft", "published"] as const;\n');
      const [failure] = attempt<ts.Program, Error>(() =>
        createCanonicalValuesTypeScriptProgram({
          repositoryRoot: malformedRoot,
          rootNames: [ownerPath],
          searchDirectory: join(malformedRoot, "src"),
        }),
      );
      return failure === null ? null : failure.message;
    });

    it("surfaces its first diagnostic", ({ malformedConfigFailure }) => {
      expect(malformedConfigFailure).toBe(
        "Compiler option 'module' requires a value of type string.",
      );
    });
  });

  describe("a tsx source override", () => {
    const tsxRoot = join(tmpdir(), "canonical-values-typescript-program-tsx");

    const it = test.extend("tsxOverrideSyntaxErrors", ({}, { onCleanup }) => {
      rmSync(tsxRoot, { force: true, recursive: true });
      mkdirSync(join(tsxRoot, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(tsxRoot, { force: true, recursive: true });
      });
      const sourcePath = join(tsxRoot, "src/owner.tsx");
      const program = createCanonicalValuesTypeScriptProgram({
        repositoryRoot: tsxRoot,
        rootNames: [sourcePath],
        searchDirectory: join(tsxRoot, "src"),
        sourceOverrides: new Map([[sourcePath, "export const view = <main />;\n"]]),
      });
      const overriddenSource = program.getSourceFile(sourcePath);
      if (overriddenSource === undefined) throw new Error("the source override was not parsed");
      return program
        .getSyntacticDiagnostics(overriddenSource)
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    });

    it("carries jsx that only the jsx script kind accepts", ({ tsxOverrideSyntaxErrors }) => {
      expect(tsxOverrideSyntaxErrors).toStrictEqual([]);
    });
  });

  describe("a ts source override", () => {
    const tsRoot = join(tmpdir(), "canonical-values-typescript-program-ts");

    const it = test.extend("tsOverrideSyntaxErrors", ({}, { onCleanup }) => {
      rmSync(tsRoot, { force: true, recursive: true });
      mkdirSync(join(tsRoot, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(tsRoot, { force: true, recursive: true });
      });
      const sourcePath = join(tsRoot, "src/owner.ts");
      const program = createCanonicalValuesTypeScriptProgram({
        repositoryRoot: tsRoot,
        rootNames: [sourcePath],
        searchDirectory: join(tsRoot, "src"),
        sourceOverrides: new Map([[sourcePath, 'export const label = <string>"draft";\n']]),
      });
      const overriddenSource = program.getSourceFile(sourcePath);
      if (overriddenSource === undefined) throw new Error("the source override was not parsed");
      return program
        .getSyntacticDiagnostics(overriddenSource)
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    });

    it("carries an assertion that only the standard script kind accepts", ({
      tsOverrideSyntaxErrors,
    }) => {
      expect(tsOverrideSyntaxErrors).toStrictEqual([]);
    });
  });
});
