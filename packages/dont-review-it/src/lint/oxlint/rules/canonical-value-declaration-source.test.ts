import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import {
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFiles,
} from "../lib/canonical-values/canonical-values-test-fixture.ts";
import * as typescriptProgram from "../lib/canonical-values/typescript-program.ts";
import {
  createCanonicalValueDeclarationSourceIndex,
  type CanonicalValueDeclarationSourceIndex,
} from "./canonical-value-declaration-source.ts";

vi.mock(import("../lib/canonical-values/typescript-program.ts"), { spy: true });

const sourcePathAt = (input: {
  readonly index: CanonicalValueDeclarationSourceIndex | null;
  readonly sourceText: string;
  readonly token: string;
}): string | null => {
  const start = input.sourceText.lastIndexOf(input.token);
  return (
    input.index?.outOfScopeSource({ end: start + input.token.length, start })?.sourcePath ?? null
  );
};

describe("canonical value declaration source index", () => {
  test("out-of-scope declaration sources are attached only to their consumer identifiers", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const referenceType =
      '/// <reference path="../fixtures/status.d.ts" />\nexport type LocalStatus = FixtureStatus;\n';
    const referenceValue =
      '/// <reference path="../fixtures/status.d.ts" />\nexport const schema = z.enum(FIXTURE_STATUSES);\n';
    const ambientGlobal = "export type LocalStatus = FixtureStatus;\n";
    const amdDependency =
      '/// <amd-dependency path="../fixtures/status.ts" name="fixtureStatus" />\nconsume(fixtureStatus.STATUS);\n';
    const unused = 'export type LocalStatus = "draft" | "published";\n';
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "fixtures/status.d.ts":
          'type FixtureStatus = "draft" | "published";\ndeclare const FIXTURE_STATUSES: readonly ["draft", "published"];\n',
        "fixtures/status.ts": 'export const STATUS = "draft";\n',
        "src/amd.ts": amdDependency,
        "src/ambient-global.ts": ambientGlobal,
        "src/reference-type.ts": referenceType,
        "src/reference-value.ts": referenceValue,
        "src/unused.ts": unused,
      },
    });
    const indexFor = (relativePath: string, sourceText: string) =>
      createCanonicalValueDeclarationSourceIndex({
        filename: join(repositoryRoot, relativePath),
        repositoryRoot,
        sourceText,
      });
    expect(
      sourcePathAt({
        index: indexFor("src/reference-type.ts", referenceType),
        sourceText: referenceType,
        token: "FixtureStatus",
      }),
    ).toBe("fixtures/status.d.ts");
    expect(
      sourcePathAt({
        index: indexFor("src/reference-value.ts", referenceValue),
        sourceText: referenceValue,
        token: "FIXTURE_STATUSES",
      }),
    ).toBe("fixtures/status.d.ts");
    expect(
      sourcePathAt({
        index: indexFor("src/ambient-global.ts", ambientGlobal),
        sourceText: ambientGlobal,
        token: "FixtureStatus",
      }),
    ).toBe("fixtures/status.d.ts");
    expect(
      sourcePathAt({
        index: indexFor("src/unused.ts", unused),
        sourceText: unused,
        token: "LocalStatus",
      }),
    ).toBeNull();
    expect(indexFor("src/amd.ts", amdDependency)?.amdDependencySpecifiers).toStrictEqual([
      "../fixtures/status.ts",
    ]);
  });

  test("an in-memory consumer uses its current source text for declaration identity", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const onDisk = "export type LocalStatus = string;\n";
    const current = "export type LocalStatus = FixtureStatus;\n";
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "fixtures/status.d.ts": 'type FixtureStatus = "draft" | "published";\n',
        "src/status.ts": onDisk,
      },
    });
    const index = createCanonicalValueDeclarationSourceIndex({
      filename: join(repositoryRoot, "src/status.ts"),
      repositoryRoot,
      sourceText: current,
    });
    expect(sourcePathAt({ index, sourceText: current, token: "FixtureStatus" })).toBe(
      "fixtures/status.d.ts",
    );
  });

  test("one configured repository program indexes sibling consumers before lookup", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const firstSource = "export type FirstStatus = FixtureStatus;\n";
    const secondSource = "export type SecondStatus = FixtureStatus;\n";
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "fixtures/status.d.ts": 'type FixtureStatus = "draft" | "published";\n',
        "src/first.ts": firstSource,
        "src/nested/second.ts": secondSource,
        "tsconfig.json": JSON.stringify({ include: ["src", "fixtures"] }),
      },
    });
    vi.mocked(typescriptProgram.createCanonicalValuesTypeScriptProgram).mockClear();
    const indexFor = (relativePath: string, sourceText: string) =>
      createCanonicalValueDeclarationSourceIndex({
        filename: join(repositoryRoot, relativePath),
        repositoryRoot,
        sourceText,
      });

    expect(
      sourcePathAt({
        index: indexFor("src/first.ts", firstSource),
        sourceText: firstSource,
        token: "FixtureStatus",
      }),
    ).toBe("fixtures/status.d.ts");
    expect(
      sourcePathAt({
        index: indexFor("src/nested/second.ts", secondSource),
        sourceText: secondSource,
        token: "FixtureStatus",
      }),
    ).toBe("fixtures/status.d.ts");
    expect(typescriptProgram.createCanonicalValuesTypeScriptProgram).toHaveBeenCalledTimes(1);
  });
});
