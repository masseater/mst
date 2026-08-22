import { describe, expect, test } from "vite-plus/test";

import { indicatesDetachedHead, indicatesNotAWorkingTree } from "./git-runner.ts";

class GitStderrError extends Error {
  readonly stderr: unknown;

  constructor(complaint: string, stderr: unknown) {
    super(complaint);
    this.stderr = stderr;
  }
}

describe("indicatesDetachedHead", () => {
  const it = test
    .extend("detachedFromStderrText", () =>
      indicatesDetachedHead(
        new GitStderrError("git failed", "fatal: ref HEAD is not a symbolic ref"),
      ))
    .extend("detachedFromMessageText", () =>
      indicatesDetachedHead(new Error("HEAD is not a symbolic ref")),
    )
    .extend("detachedFromUnrelatedError", () =>
      indicatesDetachedHead(new Error("some unrelated failure")),
    )
    .extend("detachedFromNonError", () => indicatesDetachedHead("broken"))
    .extend("detachedFromNonStringStderr", () =>
      indicatesDetachedHead(new GitStderrError("some failure", 42)),
    )
    .extend("detachedFromMessageWithNonStringStderr", () =>
      indicatesDetachedHead(new GitStderrError("ref HEAD is not a symbolic ref", 42)),
    );

  it("stderr プロパティに fatal テキストが載っていても検出する", ({ detachedFromStderrText }) => {
    expect(detachedFromStderrText).toStrictEqual(true);
  });

  it("stderr プロパティを持たない Error はメッセージ本文だけを見る", ({
    detachedFromMessageText,
  }) => {
    expect(detachedFromMessageText).toStrictEqual(true);
  });

  it("stderr も本文もマーカーを含まなければ検出しない", ({ detachedFromUnrelatedError }) => {
    expect(detachedFromUnrelatedError).toStrictEqual(false);
  });

  it("Error でない値は検出しない", ({ detachedFromNonError }) => {
    expect(detachedFromNonError).toStrictEqual(false);
  });

  it("stderr プロパティが文字列でなければメッセージ本文だけを見る", ({
    detachedFromNonStringStderr,
  }) => {
    expect(detachedFromNonStringStderr).toStrictEqual(false);
  });

  it("stderr が本文にマーカーを含む場合は検出する", ({
    detachedFromMessageWithNonStringStderr,
  }) => {
    expect(detachedFromMessageWithNonStringStderr).toStrictEqual(true);
  });
});

describe("indicatesNotAWorkingTree", () => {
  const it = test
    .extend("notAWorkingTreeFromUnrelatedError", () =>
      indicatesNotAWorkingTree(new Error("some other failure")))
    .extend("notAWorkingTreeFromStderrText", () =>
      indicatesNotAWorkingTree(
        new GitStderrError("git failed", "fatal: 'x' is not a working tree"),
      ),
    );

  it("stderr にもメッセージ本文にも無ければ検出しない", ({ notAWorkingTreeFromUnrelatedError }) => {
    expect(notAWorkingTreeFromUnrelatedError).toStrictEqual(false);
  });

  it("stderr に fatal テキストが載っていれば検出する", ({ notAWorkingTreeFromStderrText }) => {
    expect(notAWorkingTreeFromStderrText).toStrictEqual(true);
  });
});
