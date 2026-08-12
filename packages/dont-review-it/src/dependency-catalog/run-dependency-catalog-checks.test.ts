import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "./config.ts";
import { runDependencyCatalogChecks } from "./run-dependency-catalog-checks.ts";

const config = defaultDependencyCatalogChecksConfig;

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  for (const [path, text] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  }
  return root;
};

const reportFor = (files: Readonly<Record<string, string>>) =>
  runDependencyCatalogChecks({ repositoryRoot: repositoryWith(files), config });

const findingsFor = (files: Readonly<Record<string, string>>) => reportFor(files).problems;

describe("runDependencyCatalogChecks", () => {
  it("stays silent where no workspace definition marks pnpm usage", () => {
    expect(findingsFor({ "package.json": `{"dependencies": {"react": "^19.0.0"}}` })).toStrictEqual(
      [],
    );
  });

  it("reports a workspace definition that does not parse", () => {
    const { problems, definitionUnreadable } = reportFor({
      "pnpm-workspace.yaml": "packages: [\n",
    });

    expect(problems.length).toBe(1);
    expect(problems[0]?.file).toBe("pnpm-workspace.yaml");
    expect(problems[0]?.message).toContain("does not parse");
    expect(definitionUnreadable).toBe(true);
  });

  it("reports the catalog entry that only one manifest uses", () => {
    const findings = findingsFor({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
      "package.json": `{"name": "root"}`,
      "packages/web/package.json": `{"dependencies": {"react": "catalog:"}}`,
    });

    expect(findings.length).toBe(1);
    expect(findings[0]?.message).toContain("packages/web/package.json");
  });

  it("keeps quiet about an entry that a workspace override references", () => {
    expect(
      findingsFor({
        "pnpm-workspace.yaml": `packages:\n  - packages/*\ncatalog:\n  vite: ^6.0.0\noverrides:\n  vite: "catalog:"\n`,
        "packages/web/package.json": `{"dependencies": {"vite": "catalog:"}}`,
      }),
    ).toStrictEqual([]);
  });

  it("keeps quiet about an entry that a root manifest override references", () => {
    expect(
      findingsFor({
        "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  vite: ^6.0.0\n",
        "package.json": `{"pnpm": {"overrides": {"vite": "catalog:"}}}`,
        "packages/web/package.json": `{"dependencies": {"vite": "catalog:"}}`,
      }),
    ).toStrictEqual([]);
  });

  it("tells a single manifest to inline the entry rather than to reference it", () => {
    const findings = findingsFor({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
      "packages/web/package.json": `{"dependencies": {"react": "^19.0.0"}}`,
    });

    expect(findings.length).toBe(1);
    expect(findings[0]?.message).toContain("delete the entry");
  });

  it("tells the second manifest that pins the catalog version to reference the catalog", () => {
    const findings = findingsFor({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
      "packages/web/package.json": `{"dependencies": {"react": "catalog:"}}`,
      "packages/site/package.json": `{"dependencies": {"react": "^19.0.0"}}`,
    });

    expect(findings.length).toBe(1);
    expect(findings[0]?.file).toBe("packages/site/package.json");
    expect(findings[0]?.message).toContain("Replace the specifier with catalog:");
  });

  it("reports the version that two manifests pin outside the catalog", () => {
    const findings = findingsFor({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/web/package.json": `{"devDependencies": {"typescript": "^5.0.0"}}`,
      "packages/site/package.json": `{"devDependencies": {"typescript": "^5.0.0"}}`,
    });

    expect(findings.length).toBe(1);
    expect(findings[0]?.message).toContain("Add typescript to the catalog");
  });

  it("reports disagreements as problems", () => {
    const { problems } = reportFor({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/web/package.json": `{"devDependencies": {"typescript": "^5.0.0"}}`,
      "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
    });

    expect(problems.length).toBe(1);
    expect(problems[0]?.message).toContain("Choose the intended version");
  });

  it("orders the findings by file and then by message", () => {
    const findings = findingsFor({
      "pnpm-workspace.yaml":
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n  zod: ^4.0.0\n  axios: ^1.0.0\n",
      "packages/web/package.json": `{"dependencies": {"react": "catalog:", "zod": "catalog:", "axios": "catalog:"}}`,
      "packages/site/package.json": `{"dependencies": {"react": "^19.0.0"}}`,
    });

    expect(findings.map((problem) => problem.file)).toStrictEqual([
      "packages/site/package.json",
      "pnpm-workspace.yaml",
      "pnpm-workspace.yaml",
    ]);
    expect(findings[1]?.message).toContain("axios");
    expect(findings[2]?.message).toContain("zod");
  });
});
