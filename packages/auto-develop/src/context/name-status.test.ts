import { describe, expect, test } from "vite-plus/test";

import { isDeletion, parseNameStatus } from "./name-status.ts";

describe("parseNameStatus", () => {
  test("変更・追加・削除は 2 フィールドでパスを取る", () => {
    const output = "M\tsrc/a.ts\nA\tsrc/b.ts\nD\tsrc/c.ts";
    expect(parseNameStatus(output).map((file) => [file.statusCode, file.path])).toStrictEqual([
      ["M", "src/a.ts"],
      ["A", "src/b.ts"],
      ["D", "src/c.ts"],
    ]);
  });

  test("rename は類似度コードと新旧パスの 3 フィールドで取る", () => {
    const output = "R100\tsrc/old.ts\tsrc/new.ts";
    const [file] = parseNameStatus(output);
    expect([file?.statusCode, file?.path, file?.previousPath]).toStrictEqual([
      "R100",
      "src/new.ts",
      "src/old.ts",
    ]);
  });

  test("空行は読み飛ばす", () => {
    expect(parseNameStatus("\n\n")).toStrictEqual([]);
  });

  test("タブを欠く不正行はパスを空にする", () => {
    const [file] = parseNameStatus("M");
    expect([file?.statusCode, file?.path]).toStrictEqual(["M", ""]);
  });

  test("新パスを欠く rename 行は旧パスへ倒す", () => {
    const [file] = parseNameStatus("R100\tsrc/old.ts");
    expect([file?.path, file?.previousPath]).toStrictEqual(["src/old.ts", "src/old.ts"]);
  });

  test("パスを持たない rename 行は両方を空にする", () => {
    const [file] = parseNameStatus("R100");
    expect([file?.path, file?.previousPath]).toStrictEqual(["", ""]);
  });

  test("状態コードを欠く行は読み飛ばす", () => {
    expect(parseNameStatus("\tsrc/a.ts")).toStrictEqual([]);
  });
});

describe("isDeletion", () => {
  test("D だけを削除とみなす", () => {
    expect([isDeletion("D"), isDeletion("M")]).toStrictEqual([true, false]);
  });
});
