import { createHash } from "node:crypto";
import { readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { buildCanonicalValuesCatalog } from "./builder.ts";
import {
  annotateCanonicalValues,
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
} from "./canonical-values-test-fixture.ts";
import { cacheInputFingerprint } from "./catalog-cache.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { listRepositoryFiles } from "./source-files.ts";

describe("catalog cache", () => {
  const cachePathOf = (repositoryRoot: string): string =>
    join(repositoryRoot, "node_modules", ".cache", "mst-dont-review-it", "canonical-values.json");

  const cacheIntegrity = (fingerprint: string, entries: readonly unknown[]): string =>
    createHash("sha256")
      .update(JSON.stringify({ version: 5, fingerprint, entries }))
      .digest("hex");

  test("a version 4 cache cannot inject an owner into the current catalog", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft"] as const;',
      ),
    });
    buildCanonicalValuesCatalog({ repositoryRoot });

    const cachePath = cachePathOf(repositoryRoot);
    const current = JSON.parse(readFileSync(cachePath, "utf8")) as {
      readonly fingerprint: string;
    };
    writeFileSync(
      cachePath,
      JSON.stringify({
        version: 4,
        fingerprint: current.fingerprint,
        entries: [
          {
            annotationStart: 0,
            binding: "POISON",
            bindingStart: 1,
            conceptId: "poison.cache",
            declarationEnd: 2,
            declarationPath: "src/poison.ts",
            declarationStart: 1,
            importRoutes: [],
            packageName: null,
            values: ["poison"],
            fingerprint: fingerprintValues(["poison"]),
          },
        ],
      }),
      "utf8",
    );

    expect(
      buildCanonicalValuesCatalog({ repositoryRoot }).entries.map((entry) => entry.conceptId),
    ).toStrictEqual(["order.status"]);
    expect(JSON.parse(readFileSync(cachePath, "utf8"))).toMatchObject({ version: 5 });
  });

  test("a version 5 cache cannot drop every real owner without invalidating its integrity", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft"] as const;',
      ),
    });
    buildCanonicalValuesCatalog({ repositoryRoot });

    const cachePath = cachePathOf(repositoryRoot);
    const current = JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, unknown>;
    writeFileSync(cachePath, JSON.stringify({ ...current, entries: [] }), "utf8");

    expect(
      buildCanonicalValuesCatalog({ repositoryRoot }).entries.map((entry) => entry.conceptId),
    ).toStrictEqual(["order.status"]);
  });

  test("source contents invalidate the cache even when size and timestamps are preserved", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const sourcePath = join(repositoryRoot, "src/order-status.ts");
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft"] as const;',
      ),
    });
    buildCanonicalValuesCatalog({ repositoryRoot });
    const originalStats = statSync(sourcePath);
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["final"] as const;',
      ),
    });
    utimesSync(sourcePath, originalStats.atime, originalStats.mtime);

    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries[0]?.values).toStrictEqual([
      "final",
    ]);
  });

  test("a retargeted source symlink invalidates identical cache contents", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const firstTarget = join(repositoryRoot, "src/first.ts");
    const secondTarget = join(repositoryRoot, "src/second.ts");
    const link = join(repositoryRoot, "src/public.ts");
    const contents = 'export const value = "draft";\n';
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/first.ts",
      contents,
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/second.ts",
      contents,
    });
    symlinkSync(firstTarget, link);
    const first = cacheInputFingerprint(listRepositoryFiles(repositoryRoot).cacheInputs);
    rmSync(link);
    symlinkSync(secondTarget, link);

    expect(cacheInputFingerprint(listRepositoryFiles(repositoryRoot).cacheInputs)).not.toBe(first);
  });

  test("an imported static value invalidates the cache when its literal domain changes", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const declarationPath = join(repositoryRoot, "src/base.ts");
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/base.ts",
      contents: annotateCanonicalValues("base.status", 'export const BASE = ["draft"] as const;'),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: `import { BASE } from "./base.js";
${annotateCanonicalValues(
  "order.status",
  'export const ORDER_STATUSES = [...BASE, "published"] as const;',
)}`,
    });
    expect(
      buildCanonicalValuesCatalog({ repositoryRoot }).entries.find(
        (entry) => entry.conceptId === "order.status",
      )?.values,
    ).toStrictEqual(["draft", "published"]);
    const originalStats = statSync(declarationPath);
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/base.ts",
      contents: annotateCanonicalValues("base.status", 'export const BASE = ["final"] as const;'),
    });
    utimesSync(declarationPath, originalStats.atime, originalStats.mtime);

    expect(
      buildCanonicalValuesCatalog({ repositoryRoot }).entries.find(
        (entry) => entry.conceptId === "order.status",
      )?.values,
    ).toStrictEqual(["final", "published"]);
  });

  test("an imported JSON object invalidates the cache when its property domain changes", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const jsonPath = join(repositoryRoot, "src/statuses.json");
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/statuses.json",
      contents: '{"draft":null,"published":null}\n',
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: `import STATUSES from "./statuses.json";
${annotateCanonicalValues("order.status", "export const ORDER_STATUS = Object.freeze(STATUSES);")}`,
    });
    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries[0]?.values).toStrictEqual([
      "draft",
      "published",
    ]);
    const originalStats = statSync(jsonPath);
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/statuses.json",
      contents: '{"final":null,"published":null}\n',
    });
    utimesSync(jsonPath, originalStats.atime, originalStats.mtime);

    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries[0]?.values).toStrictEqual([
      "final",
      "published",
    ]);
  });

  test.each([
    {
      relativePath: "pnpm-lock.yaml",
      before: "lockfileVersion: 9.0\n",
      after: "lockfileVersion: 9.1\n",
    },
    {
      relativePath: "pnpm-workspace.yaml",
      before: "packages: [packages/*]\n",
      after: "packages: [projects/*]\n",
    },
    {
      relativePath: "tsconfig.json",
      before: '{"compilerOptions":{"strict":true}}\n',
      after: '{"compilerOptions":{"strict":false}}\n',
    },
  ])(
    "a changed dependency input $relativePath invalidates the cache",
    ({ relativePath, before, after }) => {
      const repositoryRoot = createCanonicalValuesTestRepository();
      writeCanonicalValuesTestFile({ repositoryRoot, relativePath, contents: before });
      writeCanonicalValuesTestFile({
        repositoryRoot,
        relativePath: "src/order-status.ts",
        contents: annotateCanonicalValues(
          "order.status",
          'export const ORDER_STATUSES = ["draft"] as const;',
        ),
      });
      buildCanonicalValuesCatalog({ repositoryRoot });
      const cachePath = cachePathOf(repositoryRoot);
      const beforeCache = JSON.parse(readFileSync(cachePath, "utf8")) as {
        readonly fingerprint: string;
      };
      writeCanonicalValuesTestFile({ repositoryRoot, relativePath, contents: after });

      buildCanonicalValuesCatalog({ repositoryRoot });
      const afterCache = JSON.parse(readFileSync(cachePath, "utf8")) as {
        readonly fingerprint: string;
      };
      expect(afterCache.fingerprint).not.toBe(beforeCache.fingerprint);
    },
  );

  test("a version 5 cache with an impossible declaration range is rebuilt", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft"] as const;',
      ),
    });
    buildCanonicalValuesCatalog({ repositoryRoot });
    const cachePath = cachePathOf(repositoryRoot);
    const current = JSON.parse(readFileSync(cachePath, "utf8")) as {
      readonly fingerprint: string;
    };
    const entries = [
      {
        annotationStart: 4,
        binding: "POISON",
        bindingStart: 2,
        conceptId: "poison.cache",
        declarationEnd: 2,
        declarationPath: "src/poison.ts",
        declarationStart: 3,
        importRoutes: [],
        packageName: null,
        values: ["poison"],
        fingerprint: fingerprintValues(["poison"]),
      },
    ];
    writeFileSync(
      cachePath,
      JSON.stringify({
        version: 5,
        fingerprint: current.fingerprint,
        entries,
        integrity: cacheIntegrity(current.fingerprint, entries),
      }),
      "utf8",
    );

    expect(
      buildCanonicalValuesCatalog({ repositoryRoot }).entries.map((entry) => entry.conceptId),
    ).toStrictEqual(["order.status"]);
  });

  test("a version 5 cache route without resolved source identity is rebuilt", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "package.json",
      contents: JSON.stringify({ name: "@fixture/repository", exports: "./src/index.ts" }),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft"] as const;',
      ),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/index.ts",
      contents: 'export { ORDER_STATUSES } from "./order-status.ts";\n',
    });
    buildCanonicalValuesCatalog({ repositoryRoot });
    const cachePath = cachePathOf(repositoryRoot);
    const current = JSON.parse(readFileSync(cachePath, "utf8")) as {
      readonly fingerprint: string;
      readonly entries: readonly Record<string, unknown>[];
    };
    const entries = current.entries.map((entry) => ({
      ...entry,
      importRoutes: [{ exportName: "ORDER_STATUSES", specifier: "@fixture/repository" }],
    }));
    writeFileSync(
      cachePath,
      JSON.stringify({
        version: 5,
        fingerprint: current.fingerprint,
        entries,
        integrity: cacheIntegrity(current.fingerprint, entries),
      }),
      "utf8",
    );

    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries[0]?.importRoutes).toStrictEqual([
      {
        exportName: "ORDER_STATUSES",
        resolvedSourcePaths: ["src/index.ts"],
        specifier: "@fixture/repository",
      },
    ]);
  });

  test("a version 5 cache whose value fingerprint is forged is rebuilt", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft"] as const;',
      ),
    });
    buildCanonicalValuesCatalog({ repositoryRoot });
    const cachePath = cachePathOf(repositoryRoot);
    const current = JSON.parse(readFileSync(cachePath, "utf8")) as {
      readonly fingerprint: string;
    };
    const entries = [
      {
        annotationStart: 0,
        binding: "POISON",
        bindingStart: 2,
        conceptId: "poison.cache",
        declarationEnd: 3,
        declarationPath: "src/poison.ts",
        declarationStart: 1,
        importRoutes: [],
        packageName: null,
        values: ["poison"],
        fingerprint: fingerprintValues(["other"]),
      },
    ];
    writeFileSync(
      cachePath,
      JSON.stringify({
        version: 5,
        fingerprint: current.fingerprint,
        entries,
        integrity: cacheIntegrity(current.fingerprint, entries),
      }),
      "utf8",
    );

    expect(
      buildCanonicalValuesCatalog({ repositoryRoot }).entries.map((entry) => entry.conceptId),
    ).toStrictEqual(["order.status"]);
  });

  test("a changed input rebuilds the catalog", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft"] as const;',
      ),
    });
    buildCanonicalValuesCatalog({ repositoryRoot });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft", "published"] as const;',
      ),
    });

    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries[0]?.values).toStrictEqual([
      "draft",
      "published",
    ]);
  });
});
