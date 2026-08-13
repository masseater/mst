import { describe, expect, test } from "vite-plus/test";

import { carriesHaltDisposition, HaltQueueKeepJobError } from "./halt-disposition.ts";

describe("carriesHaltDisposition", () => {
  describe("恒久停止の処分指示を運ぶエラー", () => {
    const it = test.extend("haltErrorCarriesDisposition", () =>
      carriesHaltDisposition(new HaltQueueKeepJobError("engine auth expired")));

    it("恒久停止の処分指示を運ぶエラーを識別する", ({ haltErrorCarriesDisposition }) => {
      expect(haltErrorCarriesDisposition).toStrictEqual(true);
    });
  });

  describe("cause に処分指示を運ぶエラーを包んだエラー", () => {
    const it = test.extend("wrappedCauseCarriesDisposition", () =>
      carriesHaltDisposition(
        new Error("job failed", { cause: new HaltQueueKeepJobError("engine auth expired") }),
      ));

    it("cause に処分指示を運ぶエラーも識別する", ({ wrappedCauseCarriesDisposition }) => {
      expect(wrappedCauseCarriesDisposition).toStrictEqual(true);
    });
  });

  describe("処分指示を運ばない通常のエラー", () => {
    const it = test.extend("plainErrorCarriesDisposition", () =>
      carriesHaltDisposition(new Error("flaky network")));

    it("通常のエラーは処分指示を運ばない", ({ plainErrorCarriesDisposition }) => {
      expect(plainErrorCarriesDisposition).toStrictEqual(false);
    });
  });

  describe("エラーでない値", () => {
    const it = test.extend("nonErrorCarriesDisposition", () => carriesHaltDisposition("broken"));

    it("エラーでない値も処分指示を運ばない", ({ nonErrorCarriesDisposition }) => {
      expect(nonErrorCarriesDisposition).toStrictEqual(false);
    });
  });
});
