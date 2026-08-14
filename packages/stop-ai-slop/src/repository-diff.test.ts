import { symlinkSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { parseRepositoryChanges } from "./repository-diff.ts";
import { withTestRepository } from "./test-repository.ts";

const nulCharacter = String.fromCodePoint(0);

describe("parseRepositoryChanges", () => {
  it("returns no changes for empty metadata and patch", () => {
    expect(parseRepositoryChanges({ inventoryOutput: "", diff: "" })).toStrictEqual([]);
  });

  it("rejects a non-empty diff that produces no files", () => {
    expect(() => parseRepositoryChanges({ inventoryOutput: "", diff: "not a git diff\n" })).toThrow(
      "Unable to parse non-empty Git diff",
    );
  });

  it.each([
    {
      inventoryOutput: "invalid metadata",
      expectedMessage: "Invalid NUL-delimited Git diff metadata",
    },
    {
      inventoryOutput: `A${nulCharacter}${nulCharacter}`,
      expectedMessage: "Invalid NUL-delimited Git diff metadata",
    },
    {
      inventoryOutput: `R100${nulCharacter}${nulCharacter}src/current.ts${nulCharacter}`,
      expectedMessage: "Invalid NUL-delimited Git diff metadata",
    },
    {
      inventoryOutput: `X${nulCharacter}src/current.ts${nulCharacter}`,
      expectedMessage: "Unsupported Git diff status",
    },
  ])("rejects invalid inventory $inventoryOutput", ({ inventoryOutput, expectedMessage }) => {
    expect(() => parseRepositoryChanges({ inventoryOutput, diff: "" })).toThrow(expectedMessage);
  });

  it("rejects when patch parsing omits an inventory file", () => {
    expect(() =>
      parseRepositoryChanges({
        inventoryOutput: `A${nulCharacter}src/added.ts${nulCharacter}`,
        diff: "",
      }),
    ).toThrow("Git diff metadata and patch file counts disagree: 1 != 0");
  });

  it("rejects when inventory and patch file types disagree", () => {
    const addedPatch = `diff --git src/current.ts src/current.ts
new file mode 100644
index 0000000..6cd59c7
--- /dev/null
+++ src/current.ts
@@ -0,0 +1 @@
+export const current = true;
`;

    expect(() =>
      parseRepositoryChanges({
        inventoryOutput: `D${nulCharacter}src/current.ts${nulCharacter}`,
        diff: addedPatch,
      }),
    ).toThrow("Git diff metadata and patch disagree: DeletedFile != AddedFile");
  });

  it("strictly reconciles a real Git type change as deleted then added", async () => {
    await withTestRepository(async (repository) => {
      const path = "src/current.ts";
      const base = repository.commit({
        files: { [path]: "export const current = true;\n" },
      });
      unlinkSync(resolve(repository.root, path));
      symlinkSync("target.ts", resolve(repository.root, path));
      const head = repository.commit({});
      const sharedArguments = [
        "-c",
        "core.quotePath=false",
        "-c",
        "diff.renameLimit=0",
        "diff",
        "--default-prefix",
        "--find-renames",
        "--no-ext-diff",
        "--no-textconv",
        "--no-color",
      ];
      const inventoryOutput = repository.git([
        ...sharedArguments,
        "--name-status",
        "-z",
        base,
        head,
        "--",
      ]);
      const diff = repository.git([...sharedArguments, "--unified=0", base, head, "--"]);
      const patchFiles = diff.split(/(?=diff --git )/u);

      expect(parseRepositoryChanges({ inventoryOutput, diff })).toStrictEqual([
        {
          kind: "changed",
          beforePath: path,
          afterPath: path,
          addedLines: [1],
        },
      ]);
      expect(() =>
        parseRepositoryChanges({
          inventoryOutput,
          diff: patchFiles.toReversed().join(""),
        }),
      ).toThrow("Git diff metadata and patch disagree: DeletedFile != AddedFile");
    });
  });
});
