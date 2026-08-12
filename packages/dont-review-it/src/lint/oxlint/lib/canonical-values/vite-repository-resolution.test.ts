import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFiles,
} from "./canonical-values-test-fixture.ts";
import { viteConfigResolutionIsOpen } from "./vite-alias-resolution.ts";
import {
  resolveVitePublicSpecifier,
  resolveViteRepositorySpecifier,
} from "./vite-repository-resolution.ts";

const configuredRepository = (config: (repositoryRoot: string) => string): string => {
  const repositoryRoot = createCanonicalValuesTestRepository();
  writeCanonicalValuesTestFiles({
    repositoryRoot,
    files: {
      "fixtures/status.ts": 'export const status = "draft";\n',
      "src/main.ts": "export {};\n",
      "vite.config.ts": config(repositoryRoot),
    },
  });
  return repositoryRoot;
};

const resolvedSpecifier = (repositoryRoot: string, specifier: string): string | null =>
  resolveViteRepositorySpecifier({
    containingFile: join(repositoryRoot, "src/main.ts"),
    repositoryRoot,
    specifier,
  });

describe("Vite repository resolution", () => {
  test.each([
    [
      "path expression",
      () =>
        'import { resolve } from "node:path"; export default { resolve: { alias: { "@fixture": resolve(import.meta.dirname, "fixtures") } } };\n',
    ],
    [
      "file URL expression",
      () =>
        'import { fileURLToPath } from "node:url"; export default { resolve: { alias: { "@fixture": fileURLToPath(new URL("./fixtures", import.meta.url)) } } };\n',
    ],
    [
      "shorthand and spread objects",
      (repositoryRoot: string) =>
        `const alias = { "@fixture": ${JSON.stringify(join(repositoryRoot, "fixtures"))} }; const shared = { resolve: { alias } }; export default { ...shared };\n`,
    ],
  ])("resolves aliases declared through %s", (_name, config) => {
    const repositoryRoot = configuredRepository(config);
    expect(resolvedSpecifier(repositoryRoot, "@fixture/status.ts")).toBe(
      join(repositoryRoot, "fixtures/status.ts"),
    );
  });

  test("honours configured extension precedence", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "src/main.ts": "export {};\n",
        "src/status.fixture.ts": 'export const status = "fixture";\n',
        "src/status.ts": 'export const status = "production";\n',
        "vite.config.ts": 'export default { resolve: { extensions: [".fixture.ts", ".ts"] } };\n',
      },
    });
    expect(resolvedSpecifier(repositoryRoot, "./status")).toBe(
      join(repositoryRoot, "src/status.fixture.ts"),
    );
  });

  test("uses Vite's default extensions when no config overrides them", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "src/main.ts": "export {};\n",
        "src/status.ts": 'export const status = "production";\n',
      },
    });
    expect(resolvedSpecifier(repositoryRoot, "./status")).toBe(
      join(repositoryRoot, "src/status.ts"),
    );
  });

  test("honours configured package main fields", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: {
        "packages/vocabulary/fixtures/status.ts": 'export const status = "fixture";\n',
        "packages/vocabulary/package.json": JSON.stringify({
          fixture: "./fixtures/status.ts",
          module: "./src/status.ts",
          name: "@fixture/vocabulary",
        }),
        "packages/vocabulary/src/status.ts": 'export const status = "production";\n',
        "src/main.ts": "export {};\n",
        "vite.config.ts": 'export default { resolve: { mainFields: ["fixture", "module"] } };\n',
      },
    });
    expect(resolvedSpecifier(repositoryRoot, "@fixture/vocabulary")).toBe(
      join(repositoryRoot, "packages/vocabulary/fixtures/status.ts"),
    );
  });

  test("resolves root-absolute imports from the configured Vite root", () => {
    const repositoryRoot = configuredRepository(() => 'export default { root: "fixtures" };\n');
    expect(resolvedSpecifier(repositoryRoot, "/status.ts")).toBe(
      join(repositoryRoot, "fixtures/status.ts"),
    );
  });

  test("resolves public URLs from the configured public directory", () => {
    const repositoryRoot = configuredRepository(
      () => 'export default { publicDir: "fixtures" };\n',
    );
    expect(resolveVitePublicSpecifier({ repositoryRoot, specifier: "/status.ts" })).toBe(
      join(repositoryRoot, "fixtures/status.ts"),
    );
  });

  test.each([
    [
      "a resolveId plugin",
      'export default { plugins: [{ name: "redirect", resolveId() { return null; } }] };\n',
    ],
    [
      "a computed configuration shape",
      'const section = "resolve"; export default { [section]: { alias: {} } };\n',
    ],
    [
      "an alias custom resolver",
      'export default { resolve: { alias: [{ find: "source", replacement: "target", customResolver() { return null; } }] } };\n',
    ],
  ])("keeps module resolution open for %s", (_name, config) => {
    expect(viteConfigResolutionIsOpen(configuredRepository(() => config))).toBe(true);
  });

  test("an empty plugin list keeps module resolution closed", () => {
    expect(
      viteConfigResolutionIsOpen(configuredRepository(() => "export default { plugins: [] };\n")),
    ).toBe(false);
  });
});
