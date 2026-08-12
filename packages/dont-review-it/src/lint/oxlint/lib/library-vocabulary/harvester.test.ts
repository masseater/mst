import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

type TypeEntry = {
  readonly packageName: string;
  readonly declarationsPath: string;
};

type HarvesterScenario = {
  readonly entries: readonly TypeEntry[];
  readonly snapshot: unknown;
  readonly snapshotFailure?: Error;
};

const fakes = vi.hoisted(() => {
  const scenarios = new Map<string, HarvesterScenario>();
  const openedFiles = new Map<string, readonly string[]>();
  const constructionCounts = new Map<string, number>();
  const closeCounts = new Map<string, number>();
  const environmentFailure = new Error("typescript is unavailable");

  class FakeApi {
    readonly packageDirectory: string;

    constructor({ cwd }: { readonly cwd: string }) {
      this.packageDirectory = cwd;
      constructionCounts.set(cwd, (constructionCounts.get(cwd) ?? 0) + 1);
    }

    updateSnapshot({ openFiles: askedFiles }: { readonly openFiles: readonly string[] }): unknown {
      openedFiles.set(this.packageDirectory, askedFiles);
      const scenario = scenarios.get(this.packageDirectory);
      if (scenario === undefined) throw new Error("a harvester scenario must be registered");
      if (scenario.snapshotFailure !== undefined) throw scenario.snapshotFailure;
      return scenario.snapshot;
    }

    close(): void {
      closeCounts.set(this.packageDirectory, (closeCounts.get(this.packageDirectory) ?? 0) + 1);
    }
  }

  return {
    aliasFlag: 1,
    closeCounts,
    constructionCounts,
    environmentFailure,
    FakeApi,
    openedFiles,
    scenarios,
  };
});

vi.mock(import("typescript/unstable/sync"), async (importOriginal) => {
  const original = await importOriginal();
  const assumeType = <Expected>(candidate: unknown, _witness?: Expected): Expected =>
    candidate as Expected;
  return {
    ...original,
    API: assumeType<typeof original.API>(fakes.FakeApi),
    SymbolFlags: {
      ...original.SymbolFlags,
      Alias: fakes.aliasFlag,
    },
  };
});

vi.mock(import("./dependency-types.ts"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    dependencyTypeEntries: (packageDirectory: string): readonly TypeEntry[] =>
      fakes.scenarios.get(packageDirectory)?.entries ?? [],
  };
});

vi.mock(import("../canonical-values/source-files.ts"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    nearestPackageDirectory: (_fileDirectory: string, repositoryRoot: string): string | null =>
      fakes.scenarios.has(repositoryRoot) ? repositoryRoot : null,
  };
});

vi.mock(import("../path-failure.ts"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    isEnvironmentFailure: (failure: unknown): boolean => failure === fakes.environmentFailure,
  };
});

import { loadLibraryVocabulary } from "./harvester.ts";

type FakeMemberType = {
  readonly value?: string | number;
  readonly isStringLiteralType: () => boolean;
  readonly isNumberLiteralType: () => boolean;
};

type FakeDeclaredType = {
  readonly isErrorType: () => boolean;
  readonly isUnionType: () => boolean;
  readonly getTypes: () => readonly FakeMemberType[];
};

type FakeSymbol = {
  readonly flags: number;
  readonly name: string;
  readonly declarations?: readonly { readonly path: string; readonly index: number }[];
  readonly declaredType: FakeDeclaredType;
  readonly aliased?: FakeSymbol;
};

const memberType = (
  kind: "string" | "number" | "other",
  admitted?: string | number,
): FakeMemberType => ({
  value: admitted,
  isStringLiteralType: () => kind === "string",
  isNumberLiteralType: () => kind === "number",
});

const declaredType = ({
  error = false,
  union = true,
  members = [],
}: {
  readonly error?: boolean;
  readonly union?: boolean;
  readonly members?: readonly FakeMemberType[];
}): FakeDeclaredType => ({
  isErrorType: () => error,
  isUnionType: () => union,
  getTypes: () => members,
});

const exportedType = ({
  name,
  declaration = true,
  definition = declaredType({}),
}: {
  readonly name: string;
  readonly declaration?: boolean;
  readonly definition?: FakeDeclaredType;
}): FakeSymbol => ({
  flags: 0,
  name,
  declarations: declaration ? [{ path: "/types/index.d.ts", index: name.length }] : [],
  declaredType: definition,
});

const aliasOf = (name: string, aliased: FakeSymbol): FakeSymbol => ({
  flags: fakes.aliasFlag,
  name,
  declarations: [{ path: "/types/index.d.ts", index: name.length }],
  declaredType: declaredType({}),
  aliased,
});

const checkerFor = (exported: readonly FakeSymbol[], moduleAvailable = true) => ({
  getSymbolAtLocation: () => (moduleAvailable ? { name: "dependency" } : undefined),
  getExportsOfModule: () => exported,
  getAliasedSymbol: (symbol: FakeSymbol) => {
    if (symbol.aliased === undefined) throw new Error("an alias target must be present");
    return symbol.aliased;
  },
  getDeclaredTypeOfSymbol: (symbol: FakeSymbol) => symbol.declaredType,
});

const snapshotFor = (
  entries: readonly TypeEntry[],
  exported: readonly FakeSymbol[],
): {
  readonly getDefaultProjectForFile: (declarationsPath: string) => unknown;
} => {
  const [, sourceMissing, moduleMissing, successful] = entries;
  return {
    getDefaultProjectForFile: (declarationsPath: string) => {
      if (declarationsPath === entries[0]?.declarationsPath) return undefined;
      if (declarationsPath === sourceMissing?.declarationsPath) {
        return {
          program: { getSourceFile: () => undefined },
          checker: checkerFor([]),
        };
      }
      if (declarationsPath === moduleMissing?.declarationsPath) {
        return {
          program: { getSourceFile: () => ({ path: declarationsPath }) },
          checker: checkerFor([], false),
        };
      }
      if (declarationsPath !== successful?.declarationsPath) return undefined;
      return {
        program: { getSourceFile: () => ({ path: declarationsPath }) },
        checker: checkerFor(exported),
      };
    },
  };
};

const registerScenario = (
  name: string,
  scenario: HarvesterScenario,
): { readonly filename: string; readonly repositoryRoot: string } => {
  const repositoryRoot = `/virtual/${name}`;
  fakes.scenarios.set(repositoryRoot, scenario);
  onTestFinished(() => {
    fakes.scenarios.delete(repositoryRoot);
    fakes.openedFiles.delete(repositoryRoot);
    fakes.constructionCounts.delete(repositoryRoot);
    fakes.closeCounts.delete(repositoryRoot);
  });
  return { filename: `${repositoryRoot}/src/subject.ts`, repositoryRoot };
};

const entriesFor = (name: string): readonly TypeEntry[] =>
  ["no-project", "no-source", "no-module", "exports"].map((suffix) => ({
    packageName: name,
    declarationsPath: `/virtual/${name}/node_modules/dependency/${suffix}.d.ts`,
  }));

describe("loadLibraryVocabulary", () => {
  test("it harvests literal unions from usable dependency declarations", () => {
    const entries = entriesFor("complete");
    const direct = exportedType({
      name: "Mixed",
      definition: declaredType({
        members: [memberType("string", "on"), memberType("number", 2)],
      }),
    });
    const alias = aliasOf(
      "SeverityAlias",
      exportedType({
        name: "Severity",
        definition: declaredType({
          members: [memberType("string", "error"), memberType("other")],
        }),
      }),
    );
    const exported = [
      direct,
      alias,
      exportedType({ name: "Scalar", definition: declaredType({ union: false }) }),
      exportedType({ name: "Broken", definition: declaredType({ error: true }) }),
      exportedType({
        name: "ObjectOnly",
        definition: declaredType({ members: [memberType("other")] }),
      }),
      exportedType({
        name: "Undeclared",
        declaration: false,
        definition: declaredType({ members: [memberType("string", "hidden")] }),
      }),
    ];
    const request = registerScenario("complete", {
      entries,
      snapshot: snapshotFor(entries, exported),
    });

    const harvested = loadLibraryVocabulary(request);

    expect(harvested).toStrictEqual([
      {
        packageName: "complete",
        typeName: "Mixed",
        declarationId: "/types/index.d.ts#5",
        values: ["on", 2],
        admitsUnnamedValues: false,
      },
      {
        packageName: "complete",
        typeName: "SeverityAlias",
        declarationId: "/types/index.d.ts#8",
        values: ["error"],
        admitsUnnamedValues: true,
      },
    ]);
    expect(fakes.openedFiles.get(request.repositoryRoot)).toStrictEqual(
      entries.map((entry) => entry.declarationsPath),
    );
    expect(fakes.constructionCounts.get(request.repositoryRoot)).toBe(1);
    expect(fakes.closeCounts.get(request.repositoryRoot)).toBe(1);
  });

  test("it reuses the harvested index for the same package directory", () => {
    const entries = entriesFor("memoized");
    const request = registerScenario("memoized", {
      entries,
      snapshot: snapshotFor(entries, []),
    });

    const firstHarvest = loadLibraryVocabulary(request);
    const secondHarvest = loadLibraryVocabulary(request);

    expect(secondHarvest).toBe(firstHarvest);
    expect(fakes.constructionCounts.get(request.repositoryRoot)).toBe(1);
    expect(fakes.closeCounts.get(request.repositoryRoot)).toBe(1);
  });

  test("it returns an empty index when the source belongs to no package", () => {
    expect(
      loadLibraryVocabulary({
        filename: "/outside/repository/subject.ts",
        repositoryRoot: "/outside/repository",
      }),
    ).toStrictEqual([]);
  });

  test("it returns an empty index without opening TypeScript when the package has no typed dependencies", () => {
    const request = registerScenario("without-dependencies", {
      entries: [],
      snapshot: snapshotFor([], []),
    });

    expect(loadLibraryVocabulary(request)).toStrictEqual([]);
    expect(fakes.constructionCounts.has(request.repositoryRoot)).toBe(false);
    expect(fakes.closeCounts.has(request.repositoryRoot)).toBe(false);
  });

  test("it treats an unavailable TypeScript environment as an empty vocabulary", () => {
    const entries = entriesFor("unavailable");
    const request = registerScenario("unavailable", {
      entries,
      snapshot: snapshotFor(entries, []),
      snapshotFailure: fakes.environmentFailure,
    });

    expect(loadLibraryVocabulary(request)).toStrictEqual([]);
    expect(fakes.closeCounts.get(request.repositoryRoot)).toBe(1);
  });

  test("it closes TypeScript and surfaces a non-environment failure", () => {
    const entries = entriesFor("broken");
    const checkerFailure = new Error("checker failed");
    const request = registerScenario("broken", {
      entries,
      snapshot: snapshotFor(entries, []),
      snapshotFailure: checkerFailure,
    });

    expect(() => loadLibraryVocabulary(request)).toThrow(checkerFailure);
    expect(fakes.closeCounts.get(request.repositoryRoot)).toBe(1);
  });
});
