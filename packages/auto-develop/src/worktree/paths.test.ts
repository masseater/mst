import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { isManagedWorktreePath, resolveRealPath, worktreePathFor } from "./paths.ts";

const managedRoot = dirname(worktreePathFor(7));

const it = test
  .extend("managedDirectoryName", () => basename(worktreePathFor(7)))
  .extend("managedRootName", () => basename(managedRoot))
  .extend("managedRootParent", () => dirname(managedRoot))
  .extend("realTmpDir", () => resolveRealPath(tmpdir()))
  .extend("zeroPrNumberFailure", (): Error | null => {
    try {
      worktreePathFor(0);
      return null;
    } catch (failure) {
      return failure instanceof Error ? failure : null;
    }
  })
  .extend("fractionalPrNumberFailure", (): Error | null => {
    try {
      worktreePathFor(1.5);
      return null;
    } catch (failure) {
      return failure instanceof Error ? failure : null;
    }
  })
  .extend("managedPathVerdict", () => isManagedWorktreePath(worktreePathFor(7)))
  .extend("strayPathVerdict", () =>
    isManagedWorktreePath(join(mkdtempSync(join(tmpdir(), "auto-develop-stray-")), "pr-7")),
  )
  .extend("zeroPrNameVerdict", () => isManagedWorktreePath(join(managedRoot, "pr-0")))
  .extend("nonPrNameVerdict", () => isManagedWorktreePath(join(managedRoot, "system")));

describe("worktreePathFor", () => {
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

  it("正の安全整数でない PR 番号は即座に拒否される", ({ zeroPrNumberFailure }) => {
    expect(zeroPrNumberFailure?.message).toStrictEqual(
      "Invalid PR number for auto-develop worktree",
    );
  });

  it("小数の PR 番号も拒否される", ({ fractionalPrNumberFailure }) => {
    expect(fractionalPrNumberFailure?.message).toStrictEqual(
      "Invalid PR number for auto-develop worktree",
    );
  });
});

describe("isManagedWorktreePath", () => {
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
