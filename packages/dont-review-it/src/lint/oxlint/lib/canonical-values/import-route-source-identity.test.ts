import { realpathSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFiles,
} from "./canonical-values.test-fixture.ts";
import { repositoryModuleLocation } from "./import-route-source-identity.ts";

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
