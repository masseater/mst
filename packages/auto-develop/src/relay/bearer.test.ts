import { describe, expect, test } from "vite-plus/test";

import { extractBearer } from "./bearer.ts";

describe("extractBearer", () => {
  describe("bearer スキームのヘッダ", () => {
    const it = test.extend("credentialFromBearerScheme", () =>
      extractBearer("Bearer relay-credential"));

    it("bearer スキームのクレデンシャルを取り出す", ({ credentialFromBearerScheme }) => {
      expect(credentialFromBearerScheme).toStrictEqual("relay-credential");
    });
  });

  describe("スキームを大文字で書いたヘッダ", () => {
    const it = test.extend("credentialFromUppercasedScheme", () =>
      extractBearer("BEARER relay-credential"));

    it("スキームの大文字小文字は無視される", ({ credentialFromUppercasedScheme }) => {
      expect(credentialFromUppercasedScheme).toStrictEqual("relay-credential");
    });
  });

  describe("ヘッダそのものが無い", () => {
    const it = test.extend("credentialFromAbsentHeader", () => extractBearer(undefined));

    it("ヘッダなしは提示なしになる", ({ credentialFromAbsentHeader }) => {
      expect(credentialFromAbsentHeader).toStrictEqual(undefined);
    });
  });

  describe("スキームだけのヘッダ", () => {
    const it = test.extend("credentialFromSchemeOnlyHeader", () => extractBearer("Bearer"));

    it("スペースを含まないヘッダは提示なしになる", ({ credentialFromSchemeOnlyHeader }) => {
      expect(credentialFromSchemeOnlyHeader).toStrictEqual(undefined);
    });
  });

  describe("basic スキームのヘッダ", () => {
    const it = test.extend("credentialFromBasicScheme", () => extractBearer("Basic dXNlcjpwYXNz"));

    it("別スキームは提示なしになる", ({ credentialFromBasicScheme }) => {
      expect(credentialFromBasicScheme).toStrictEqual(undefined);
    });
  });
});
