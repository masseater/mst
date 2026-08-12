import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { gitOutput } from "../git-output.ts";
import { listRepositoryFiles, nearestPackageDirectory } from "./source-files.ts";

describe("source-files", () => {
  const createRepository = (): string => {
    const root = mkdtempSync(join(tmpdir(), "source-files-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return root;
  };

  const createDirectory = (root: string, relativePath: string): string => {
    const absolutePath = join(root, relativePath);
    mkdirSync(absolutePath, { recursive: true });
    return absolutePath;
  };

  const initializeGit = (root: string): void => {
    gitOutput(["init", "--quiet"], { cwd: root, env: process.env });
  };

  const createManifest = (directory: string): void => {
    writeFileSync(join(directory, "package.json"), "{}", "utf8");
  };

  test("a directory that holds a manifest is its own package", () => {
    const root = createRepository();
    const workspace = createDirectory(root, "packages/order");
    createManifest(workspace);

    expect(nearestPackageDirectory(workspace, root)).toBe(workspace);
  });

  test("a directory below a manifest belongs to the package that holds it", () => {
    const root = createRepository();
    const workspace = createDirectory(root, "packages/order");
    createManifest(workspace);
    const nested = createDirectory(root, "packages/order/src/lint");

    expect(nearestPackageDirectory(nested, root)).toBe(workspace);
  });

  test("the nearer manifest wins over the one further up", () => {
    const root = createRepository();
    createManifest(root);
    const workspace = createDirectory(root, "packages/order");
    createManifest(workspace);

    expect(nearestPackageDirectory(join(workspace, "src"), root)).toBe(workspace);
  });

  test("a directory under a repository whose root holds the only manifest belongs to the root", () => {
    const root = createRepository();
    createManifest(root);
    const nested = createDirectory(root, "scripts");

    expect(nearestPackageDirectory(nested, root)).toBe(root);
  });

  test("a repository whose root holds no manifest leaves the file in no package", () => {
    const root = createRepository();
    const nested = createDirectory(root, "scripts");

    expect(nearestPackageDirectory(nested, root)).toBe(null);
  });

  test("a directory outside the repository cannot acquire a package", () => {
    const root = createRepository();

    expect(nearestPackageDirectory(dirname(root), root)).toBe(null);
  });

  test("only production TypeScript sources can declare canonical values", () => {
    const root = createRepository();
    const files = [
      "src/order-status.ts",
      "src/order-status.test.ts",
      "src/order-status.test.helper.ts",
      "src/order-status.test-d.ts",
      "src/OrderStatus.stories.tsx",
      "src/Owner.stories.fixture.ts",
      "fixtures/order-status.ts",
      "src/order-status.d.ts",
      "src/contest.ts",
      "src/latest.ts",
    ];
    for (const relativePath of files) {
      const absolutePath = join(root, relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, "export const value = 1;\n", "utf8");
    }

    const listed = listRepositoryFiles(root);

    expect(listed.declarationSources.map((file) => file.relativePath)).toStrictEqual([
      "src/contest.ts",
      "src/latest.ts",
      "src/order-status.ts",
    ]);
    expect(listed.commentSources.map((file) => file.relativePath)).toStrictEqual(files.toSorted());
  });

  test("cache inputs cover checker sources, declarations, JSON, and dependency configuration", () => {
    const root = createRepository();
    const cacheInputs = [
      ".npmrc",
      ".yarnrc.yml",
      "bun.lock",
      "bun.lockb",
      "deno.lock",
      "dist/generated.d.ts",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "src/data.json",
      "src/runtime.ts",
      "src/types.d.ts",
      "tsconfig.json",
      "yarn.lock",
    ];
    const files = [...cacheInputs, "README.md"];
    for (const relativePath of files) {
      const absolutePath = join(root, relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, "{}\n", "utf8");
    }

    const listed = listRepositoryFiles(root);

    expect(listed.cacheInputs.map((file) => file.relativePath)).toStrictEqual(
      cacheInputs.toSorted(),
    );
    expect(listed.commentSources.map((file) => file.relativePath)).toStrictEqual([
      "src/runtime.ts",
      "src/types.d.ts",
    ]);
    expect(listed.manifests.map((file) => file.relativePath)).toStrictEqual(["package.json"]);
  });

  test("style sheets and markup sources are listed apart from script sources", () => {
    const root = createRepository();
    const files = {
      "index.html": "<main></main>\n",
      "src/icon.svg": "<svg></svg>\n",
      "src/status.css": ".draft { color: red; }\n",
      "src/status.ts": "export const status = 'draft';\n",
    };
    for (const [relativePath, source] of Object.entries(files)) {
      const absolutePath = join(root, relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, source);
    }

    const listed = listRepositoryFiles(root);

    expect(listed.commentSources.map((file) => file.relativePath)).toStrictEqual(["src/status.ts"]);
    expect(listed.styleSheets.map((file) => file.relativePath)).toStrictEqual(["src/status.css"]);
    expect(listed.markupSources.map((file) => file.relativePath)).toStrictEqual([
      "index.html",
      "src/icon.svg",
    ]);
  });

  test("an internal source symlink keeps cache identity but cannot promote generated source", () => {
    const root = createRepository();
    const target = join(root, "dist/generated/consumer.ts");
    const link = join(root, "src/consumer.ts");
    mkdirSync(dirname(target), { recursive: true });
    mkdirSync(dirname(link), { recursive: true });
    writeFileSync(
      target,
      '// eslint-disable-next-line -- escape\nexport const status = "draft";\n',
    );
    symlinkSync(target, link);

    const listed = listRepositoryFiles(root);

    expect(listed.commentSources.map((file) => file.relativePath)).toStrictEqual([
      "src/consumer.ts",
    ]);
    expect(listed.declarationSources).toStrictEqual([]);
    expect(listed.cacheInputs.map((file) => file.relativePath)).toContain("src/consumer.ts");
    expect(listed.problems).toStrictEqual([]);
  });

  test("a physical source is scanned once through internal aliases", () => {
    const root = createRepository();
    const source = join(root, "src/status.ts");
    mkdirSync(dirname(source), { recursive: true });
    writeFileSync(source, "export const status = 'draft';\n");
    symlinkSync("status.ts", join(root, "src/status-alias.ts"));

    const listed = listRepositoryFiles(root);

    expect(listed.commentSources.map((file) => file.relativePath)).toStrictEqual(["src/status.ts"]);
    expect(listed.cacheInputs.map((file) => file.relativePath)).toStrictEqual([
      "src/status-alias.ts",
      "src/status.ts",
    ]);
  });

  test("an internal directory symlink is scanned through its repository alias", () => {
    const root = createRepository();
    createDirectory(root, "shared");
    writeFileSync(join(root, "shared/status.ts"), "export const status = 'draft';\n");
    createDirectory(root, "src");
    symlinkSync("../shared", join(root, "src/shared"));

    const listed = listRepositoryFiles(root);

    expect(listed.cacheInputs.map((file) => file.relativePath)).toStrictEqual([
      "shared/status.ts",
      "src/shared/status.ts",
    ]);
    expect(listed.commentSources.map((file) => file.relativePath)).toStrictEqual([
      "shared/status.ts",
    ]);
  });

  test("a symbolic file with an unscanned name stays outside source collections", () => {
    const root = createRepository();
    writeFileSync(join(root, "README.md"), "status\n");
    symlinkSync("README.md", join(root, "README-link.md"));

    expect(listRepositoryFiles(root).cacheInputs).toStrictEqual([]);
  });

  test("external and broken source symlinks become strict repository problems", () => {
    const outer = createRepository();
    const root = createDirectory(outer, "repository");
    const sourceDirectory = createDirectory(root, "src");
    writeFileSync(join(outer, "external.ts"), 'export const status = "draft";\n');
    symlinkSync(join(outer, "external.ts"), join(sourceDirectory, "external.ts"));
    symlinkSync(join(outer, "missing.ts"), join(sourceDirectory, "missing.ts"));

    expect(listRepositoryFiles(root).problems).toStrictEqual([
      { kind: "unsafe-symbolic-link", line: 1, filePath: "src/external.ts" },
      { kind: "unsafe-symbolic-link", line: 1, filePath: "src/missing.ts" },
    ]);
  });

  test("a symbolic-link cycle becomes a strict repository problem", () => {
    const root = createRepository();
    const sourceDirectory = createDirectory(root, "src");
    symlinkSync(sourceDirectory, join(sourceDirectory, "cycle"));

    expect(listRepositoryFiles(root).problems).toStrictEqual([
      { kind: "unsafe-symbolic-link", line: 1, filePath: "src/cycle/cycle" },
    ]);
  });

  test("an external agent-artifact symlink stays outside the repository scan", () => {
    const outer = createRepository();
    const root = createDirectory(outer, "repository");
    const artifacts = createDirectory(outer, "agent-artifacts");
    writeFileSync(join(artifacts, "notes.ts"), 'export const status = "draft";\n');
    symlinkSync(artifacts, join(root, ".local-agents"));

    expect(listRepositoryFiles(root)).toStrictEqual({
      cacheInputs: [],
      commentSources: [],
      declarationSources: [],
      manifests: [],
      markupSources: [],
      problems: [],
      styleSheets: [],
    });
  });

  test("an untracked ignored source does not enter any repository source collection", () => {
    const root = createRepository();
    initializeGit(root);
    createDirectory(root, "ignored");
    writeFileSync(join(root, ".gitignore"), "ignored\n");
    writeFileSync(join(root, "ignored/status.ts"), 'export const status = "draft";\n');

    expect(listRepositoryFiles(root)).toStrictEqual({
      cacheInputs: [],
      commentSources: [],
      declarationSources: [],
      manifests: [],
      markupSources: [],
      problems: [],
      styleSheets: [],
    });
  });

  test("a tracked source stays in repository collections after an ignore rule is added", () => {
    const root = createRepository();
    initializeGit(root);
    createDirectory(root, "ignored");
    writeFileSync(join(root, "ignored/status.ts"), 'export const status = "draft";\n');
    gitOutput(["add", "ignored/status.ts"], { cwd: root, env: process.env });
    writeFileSync(join(root, ".gitignore"), "ignored\n");

    const listed = listRepositoryFiles(root);

    expect(listed.cacheInputs.map((file) => file.relativePath)).toStrictEqual([
      "ignored/status.ts",
    ]);
    expect(listed.commentSources.map((file) => file.relativePath)).toStrictEqual([
      "ignored/status.ts",
    ]);
    expect(listed.declarationSources.map((file) => file.relativePath)).toStrictEqual([
      "ignored/status.ts",
    ]);
  });

  test("an ignored external symlink is omitted before unsafe-link validation", () => {
    const outer = createRepository();
    const root = createDirectory(outer, "repository");
    initializeGit(root);
    writeFileSync(join(root, ".gitignore"), "ignored.ts\n");
    writeFileSync(join(outer, "external.ts"), 'export const status = "draft";\n');
    symlinkSync(join(outer, "external.ts"), join(root, "ignored.ts"));

    expect(listRepositoryFiles(root).problems).toStrictEqual([]);
  });

  test("a tracked ignored external symlink remains an unsafe repository source", () => {
    const outer = createRepository();
    const root = createDirectory(outer, "repository");
    initializeGit(root);
    writeFileSync(join(outer, "external.ts"), 'export const status = "draft";\n');
    symlinkSync(join(outer, "external.ts"), join(root, "ignored.ts"));
    gitOutput(["add", "ignored.ts"], { cwd: root, env: process.env });
    writeFileSync(join(root, ".gitignore"), "ignored.ts\n");

    expect(listRepositoryFiles(root).problems).toStrictEqual([
      { kind: "unsafe-symbolic-link", line: 1, filePath: "ignored.ts" },
    ]);
  });
});
