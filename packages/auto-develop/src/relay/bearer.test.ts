import { describe, expect, test } from "vite-plus/test";

import { extractBearer } from "./bearer.ts";

const it = test
  .extend("credentialFromBearerScheme", () => extractBearer("Bearer relay-credential"))
  .extend("credentialFromUppercasedScheme", () => extractBearer("BEARER relay-credential"))
  .extend("credentialFromAbsentHeader", () => extractBearer(undefined))
  .extend("credentialFromSchemeOnlyHeader", () => extractBearer("Bearer"))
  .extend("credentialFromBasicScheme", () => extractBearer("Basic dXNlcjpwYXNz"));

describe("extractBearer", () => {
  it("bearer スキームのクレデンシャルを取り出す", ({ credentialFromBearerScheme }) => {
    expect(credentialFromBearerScheme).toStrictEqual("relay-credential");
  });

  it("スキームの大文字小文字は無視される", ({ credentialFromUppercasedScheme }) => {
    expect(credentialFromUppercasedScheme).toStrictEqual("relay-credential");
  });

  it("ヘッダなしは提示なしになる", ({ credentialFromAbsentHeader }) => {
    expect(credentialFromAbsentHeader).toStrictEqual(undefined);
  });

  it("スペースを含まないヘッダは提示なしになる", ({ credentialFromSchemeOnlyHeader }) => {
    expect(credentialFromSchemeOnlyHeader).toStrictEqual(undefined);
  });

  it("別スキームは提示なしになる", ({ credentialFromBasicScheme }) => {
    expect(credentialFromBasicScheme).toStrictEqual(undefined);
  });
});
