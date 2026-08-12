import { describe, expect, test } from "vite-plus/test";

import { carriesHaltDisposition, HaltQueueKeepJobError } from "./halt-disposition.ts";

const it = test
  .extend("haltErrorCarriesDisposition", () =>
    carriesHaltDisposition(new HaltQueueKeepJobError("engine auth expired")))
  .extend("wrappedCauseCarriesDisposition", () =>
    carriesHaltDisposition(
      new Error("job failed", { cause: new HaltQueueKeepJobError("engine auth expired") }),
    ),
  )
  .extend("plainErrorCarriesDisposition", () => carriesHaltDisposition(new Error("flaky network")))
  .extend("nonErrorCarriesDisposition", () => carriesHaltDisposition("broken"));

describe("carriesHaltDisposition", () => {
  it("恒久停止の処分指示を運ぶエラーを識別する", ({ haltErrorCarriesDisposition }) => {
    expect(haltErrorCarriesDisposition).toStrictEqual(true);
  });

  it("cause に処分指示を運ぶエラーも識別する", ({ wrappedCauseCarriesDisposition }) => {
    expect(wrappedCauseCarriesDisposition).toStrictEqual(true);
  });

  it("通常のエラーは処分指示を運ばない", ({ plainErrorCarriesDisposition }) => {
    expect(plainErrorCarriesDisposition).toStrictEqual(false);
  });

  it("エラーでない値も処分指示を運ばない", ({ nonErrorCarriesDisposition }) => {
    expect(nonErrorCarriesDisposition).toStrictEqual(false);
  });
});
