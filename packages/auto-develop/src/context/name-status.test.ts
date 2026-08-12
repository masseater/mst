import { describe, expect, test } from "vite-plus/test";

import { isDeletion, parseNameStatus } from "./name-status.ts";

const it = test
  .extend("modifiedAddedDeletedRows", () =>
    parseNameStatus("M\tsrc/a.ts\nA\tsrc/b.ts\nD\tsrc/c.ts"))
  .extend("renamedRows", () => parseNameStatus("R100\tsrc/old.ts\tsrc/new.ts"))
  .extend("blankOnlyRows", () => parseNameStatus("\n\n"))
  .extend("rowsWithoutTab", () => parseNameStatus("M"))
  .extend("renameRowsWithoutNewPath", () => parseNameStatus("R100\tsrc/old.ts"))
  .extend("renameRowsWithoutPaths", () => parseNameStatus("R100"))
  .extend("rowsWithoutStatusCode", () => parseNameStatus("\tsrc/a.ts"))
  .extend("deletionFlagForD", () => isDeletion("D"))
  .extend("deletionFlagForM", () => isDeletion("M"));

describe("parseNameStatus", () => {
  it("変更・追加・削除は 2 フィールドでパスを取る", ({ modifiedAddedDeletedRows }) => {
    expect(modifiedAddedDeletedRows).toStrictEqual([
      {
        statusCode: "M",
        path: "src/a.ts",
        previousPath: null,
        content: null,
        omissionReason: null,
      },
      {
        statusCode: "A",
        path: "src/b.ts",
        previousPath: null,
        content: null,
        omissionReason: null,
      },
      {
        statusCode: "D",
        path: "src/c.ts",
        previousPath: null,
        content: null,
        omissionReason: null,
      },
    ]);
  });

  it("rename は類似度コードと新旧パスの 3 フィールドで取る", ({ renamedRows }) => {
    expect(renamedRows).toStrictEqual([
      {
        statusCode: "R100",
        path: "src/new.ts",
        previousPath: "src/old.ts",
        content: null,
        omissionReason: null,
      },
    ]);
  });

  it("空行は読み飛ばす", ({ blankOnlyRows }) => {
    expect(blankOnlyRows).toStrictEqual([]);
  });

  it("タブを欠く不正行はパスを空にする", ({ rowsWithoutTab }) => {
    expect(rowsWithoutTab).toStrictEqual([
      { statusCode: "M", path: "", previousPath: null, content: null, omissionReason: null },
    ]);
  });

  it("新パスを欠く rename 行は旧パスへ倒す", ({ renameRowsWithoutNewPath }) => {
    expect(renameRowsWithoutNewPath).toStrictEqual([
      {
        statusCode: "R100",
        path: "src/old.ts",
        previousPath: "src/old.ts",
        content: null,
        omissionReason: null,
      },
    ]);
  });

  it("パスを持たない rename 行は両方を空にする", ({ renameRowsWithoutPaths }) => {
    expect(renameRowsWithoutPaths).toStrictEqual([
      { statusCode: "R100", path: "", previousPath: "", content: null, omissionReason: null },
    ]);
  });

  it("状態コードを欠く行は読み飛ばす", ({ rowsWithoutStatusCode }) => {
    expect(rowsWithoutStatusCode).toStrictEqual([]);
  });
});

describe("isDeletion", () => {
  it("D を削除とみなす", ({ deletionFlagForD }) => {
    expect(deletionFlagForD).toStrictEqual(true);
  });

  it("D 以外は削除とみなさない", ({ deletionFlagForM }) => {
    expect(deletionFlagForM).toStrictEqual(false);
  });
});
