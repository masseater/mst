import { describe, expect, test } from "vite-plus/test";

import { indicatesDetachedHead, indicatesNotAWorkingTree } from "./git-runner.ts";

class GitStderrError extends Error {
  readonly stderr: unknown;

  constructor(message: string, stderr: unknown) {
    super(message);
    this.stderr = stderr;
  }
}

describe("indicatesDetachedHead", () => {
  test("stderr プロパティに fatal テキストが載っていても検出する", () => {
    expect(
      indicatesDetachedHead(
        new GitStderrError("git failed", "fatal: ref HEAD is not a symbolic ref"),
      ),
    ).toStrictEqual(true);
  });

  test("stderr プロパティを持たない Error はメッセージ本文だけを見る", () => {
    expect(indicatesDetachedHead(new Error("HEAD is not a symbolic ref"))).toStrictEqual(true);
  });

  test("stderr も本文もマーカーを含まなければ検出しない", () => {
    expect(indicatesDetachedHead(new Error("some unrelated failure"))).toStrictEqual(false);
  });

  test("Error でない値は検出しない", () => {
    expect(indicatesDetachedHead("broken")).toStrictEqual(false);
  });

  test("stderr プロパティが文字列でなければメッセージ本文だけを見る", () => {
    expect(indicatesDetachedHead(new GitStderrError("some failure", 42))).toStrictEqual(false);
  });

  test("stderr が本文にマーカーを含む場合は検出する", () => {
    const failure = new GitStderrError("ref HEAD is not a symbolic ref", 42);
    expect(indicatesDetachedHead(failure)).toStrictEqual(true);
  });
});

describe("indicatesNotAWorkingTree", () => {
  test("stderr にもメッセージ本文にも無ければ検出しない", () => {
    expect(indicatesNotAWorkingTree(new Error("some other failure"))).toStrictEqual(false);
  });

  test("stderr に fatal テキストが載っていれば検出する", () => {
    expect(
      indicatesNotAWorkingTree(
        new GitStderrError("git failed", "fatal: 'x' is not a working tree"),
      ),
    ).toStrictEqual(true);
  });
});
