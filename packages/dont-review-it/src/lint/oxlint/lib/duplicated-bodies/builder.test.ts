import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { readTextFile } from "../canonical-values/source-files.ts";
import { buildRepositoryBodyIndex, loadRepositoryBodyIndex } from "./builder.ts";

vi.mock(import("../canonical-values/source-files.ts"), { spy: true });

const VANISHED_FILE_NAME = "vanished.ts";

const TWICE = `export const twice = (value: number): number => {
  const doubled = value * 2;
  return doubled;
};
`;

const it = test
  .extend("pathsOfABodySpelledInTwoFiles", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "duplicated-bodies-builder-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "a.ts"), TWICE, "utf8");
    writeFileSync(join(repositoryRoot, "src", "b.ts"), TWICE, "utf8");
    return Array.from(buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys());
  })
  .extend("pathsOfARepositoryWhoseSourcesAreAllOutOfScope", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "duplicated-bodies-builder-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "a.test.ts"), TWICE, "utf8");
    return Array.from(buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys());
  })
  .extend("pathsOfARepositoryHoldingASourceThatDeclaresNoBody", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "duplicated-bodies-builder-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "a.ts"), TWICE, "utf8");
    writeFileSync(join(repositoryRoot, "src", "b.ts"), "export {};\n", "utf8");
    return Array.from(buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys());
  })
  .extend("pathsOfARepositoryHoldingASourceThatVanished", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "duplicated-bodies-builder-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "a.ts"), TWICE, "utf8");
    writeFileSync(join(repositoryRoot, "src", VANISHED_FILE_NAME), TWICE, "utf8");
    vi.mocked(readTextFile).mockImplementation((path) =>
      path.endsWith(VANISHED_FILE_NAME) ? null : readFileSync(path, "utf8"),
    );
    return Array.from(buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys());
  })
  .extend("theIndexOfARepositoryComesBackTheSameOnALaterAsk", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "duplicated-bodies-builder-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "a.ts"), TWICE, "utf8");
    writeFileSync(join(repositoryRoot, "src", "b.ts"), TWICE, "utf8");
    return (
      loadRepositoryBodyIndex({ repositoryRoot }) === loadRepositoryBodyIndex({ repositoryRoot })
    );
  });

describe("buildRepositoryBodyIndex", () => {
  it("a body spelled in two files is reachable through one fingerprint", ({
    pathsOfABodySpelledInTwoFiles,
  }) => {
    expect(pathsOfABodySpelledInTwoFiles).toStrictEqual(["src/a.ts", "src/b.ts"]);
  });

  it("a repository whose sources are all out of scope is indexed as empty", ({
    pathsOfARepositoryWhoseSourcesAreAllOutOfScope,
  }) => {
    expect(pathsOfARepositoryWhoseSourcesAreAllOutOfScope).toStrictEqual([]);
  });

  it("a source that declares no body of its own is left out of the index", ({
    pathsOfARepositoryHoldingASourceThatDeclaresNoBody,
  }) => {
    expect(pathsOfARepositoryHoldingASourceThatDeclaresNoBody).toStrictEqual(["src/a.ts"]);
  });

  it("a source that vanished after the listing is left out of the index", ({
    pathsOfARepositoryHoldingASourceThatVanished,
  }) => {
    expect(pathsOfARepositoryHoldingASourceThatVanished).toStrictEqual(["src/a.ts"]);
  });

  it("the index of a repository is built once and handed back on every later ask", ({
    theIndexOfARepositoryComesBackTheSameOnALaterAsk,
  }) => {
    expect(theIndexOfARepositoryComesBackTheSameOnALaterAsk).toBe(true);
  });
});
