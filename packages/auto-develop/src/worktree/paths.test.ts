import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { isManagedWorktreePath, resolveRealPath, worktreePathFor } from "./paths.ts";

const managedRoot = dirname(worktreePathFor(7));

describe("worktreePathFor", () => {
  const it = test
    .extend("managedDirectoryName", () => basename(worktreePathFor(7)))
    .extend("managedRootName", () => basename(managedRoot))
    .extend("managedRootParent", () => dirname(managedRoot))
    .extend("realTmpDir", () => resolveRealPath(tmpdir()))
    .extend("zeroPrNumberRejection", () => {
      try {
        worktreePathFor(0);
      } catch (rejection) {
        return rejection;
      }
      throw new Error("worktreePathFor accepted the PR number 0");
    })
    .extend("fractionalPrNumberRejection", () => {
      try {
        worktreePathFor(1.5);
      } catch (rejection) {
        return rejection;
      }
      throw new Error("worktreePathFor accepted the PR number 1.5");
    });

  it("PR 番号から pr- 固定名のディレクトリ名を導く", ({ managedDirectoryName }) => {
    expect(managedDirectoryName).toStrictEqual("pr-7");
  });

  it("導いたパスは専用ルート直下に置かれる", ({ managedRootName }) => {
    expect(managedRootName).toStrictEqual("auto-develop-worktree");
  });

  it("専用ルートは実体解決した一時ディレクトリ直下に置かれる", ({
    managedRootParent,
    realTmpDir,
  }) => {
    expect(managedRootParent).toStrictEqual(realTmpDir);
  });

  it("正の安全整数でない PR 番号は即座に拒否される", ({ zeroPrNumberRejection }) => {
    expect(zeroPrNumberRejection).toStrictEqual(
      new Error("Invalid PR number for auto-develop worktree"),
    );
  });

  it("小数の PR 番号も拒否される", ({ fractionalPrNumberRejection }) => {
    expect(fractionalPrNumberRejection).toStrictEqual(
      new Error("Invalid PR number for auto-develop worktree"),
    );
  });
});

describe("isManagedWorktreePath", () => {
  const it = test
    .extend("managedPathVerdict", () => isManagedWorktreePath(worktreePathFor(7)))
    .extend("strayPathVerdict", () =>
      isManagedWorktreePath(join(mkdtempSync(join(tmpdir(), "auto-develop-stray-")), "pr-7")),
    )
    .extend("zeroPrNameVerdict", () => isManagedWorktreePath(join(managedRoot, "pr-0")))
    .extend("nonPrNameVerdict", () => isManagedWorktreePath(join(managedRoot, "system")));

  it("専用ルート直下の pr- ディレクトリだけを管理対象と認める", ({ managedPathVerdict }) => {
    expect(managedPathVerdict).toStrictEqual(true);
  });

  it("専用ルート外のディレクトリは管理対象でない", ({ strayPathVerdict }) => {
    expect(strayPathVerdict).toStrictEqual(false);
  });

  it("pr-0 は正整数でないため管理対象でない", ({ zeroPrNameVerdict }) => {
    expect(zeroPrNameVerdict).toStrictEqual(false);
  });

  it("専用ルート直下でも pr- 名でなければ管理対象でない", ({ nonPrNameVerdict }) => {
    expect(nonPrNameVerdict).toStrictEqual(false);
  });
});
