import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { repositoryModuleLocation } from "./import-route-source-identity.ts";

const createCanonicalValuesTestRepository = (): string => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
  onTestFinished(() => {
    rmSync(repositoryRoot, { recursive: true, force: true });
  });
  return repositoryRoot;
};

const writeCanonicalValuesTestFiles = ({
  repositoryRoot,
  files,
}: {
  readonly repositoryRoot: string;
  readonly files: Readonly<Record<string, string>>;
}): void => {
  for (const [relativePath, fileText] of Object.entries(files)) {
    const absolutePath = join(repositoryRoot, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, fileText, "utf8");
  }
};

describe("import route source identity", () => {
  test("an external lexical symlink keeps its physical repository identity", () => {
    const fixtureRoot = createCanonicalValuesTestRepository();
    const repositoryRoot = join(fixtureRoot, "repository");
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: { "src/status.ts": "export const status = 1;\n" },
    });
    const physicalPath = join(repositoryRoot, "src/status.ts");
    const externalPath = join(fixtureRoot, "status.ts");
    symlinkSync(physicalPath, externalPath);

    expect(repositoryModuleLocation({ repositoryRoot, resolvedPath: externalPath })).toStrictEqual({
      kind: "repository",
      path: realpathSync.native(physicalPath),
      sourcePaths: [realpathSync.native(physicalPath)],
    });
  });

  test("a lexical repository symlink keeps both source identities", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFiles({
      repositoryRoot,
      files: { "src/status.ts": "export const status = 1;\n" },
    });
    const physicalPath = join(repositoryRoot, "src/status.ts");
    const lexicalPath = join(repositoryRoot, "status.ts");
    symlinkSync(physicalPath, lexicalPath);

    expect(repositoryModuleLocation({ repositoryRoot, resolvedPath: lexicalPath })).toStrictEqual({
      kind: "repository",
      path: realpathSync.native(physicalPath),
      sourcePaths: [realpathSync.native(physicalPath), lexicalPath],
    });
  });
});
