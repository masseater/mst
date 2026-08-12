import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attempt } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { isEnvironmentFailure, readUnlessMissing } from "./path-failure.ts";

class RuntimeRefusal extends Error {
  constructor(readonly code: string | number) {
    super("the runtime refused");
  }
}

const it = test
  .extend("textOfPresentPath", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "path-failure-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const path = join(root, "present.txt");
    writeFileSync(path, "written", "utf8");
    return readUnlessMissing(() => readFileSync(path, "utf8"));
  })
  .extend("statOfAbsentPath", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "path-failure-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return readUnlessMissing(() => statSync(join(root, "absent.txt")));
  })
  .extend("statOfPathRoutedThroughFile", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "path-failure-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const path = join(root, "present.txt");
    writeFileSync(path, "written", "utf8");
    return readUnlessMissing(() => statSync(join(path, "below.txt")));
  })
  .extend("messageOfRefusalCarryingWordedCode", () => {
    const [failure] = attempt<unknown, Error>(() =>
      readUnlessMissing(() => {
        throw new RuntimeRefusal("EACCES");
      }),
    );
    return failure === null ? null : failure.message;
  })
  .extend("messageOfFailureCarryingNoCode", () => {
    const [failure] = attempt<unknown, Error>(() =>
      readUnlessMissing(() => {
        throw new Error("the read failed for a reason the runtime did not name");
      }),
    );
    return failure === null ? null : failure.message;
  })
  .extend("messageOfRefusalCarryingNumberedCode", () => {
    const [failure] = attempt<unknown, Error>(() =>
      readUnlessMissing(() => {
        throw new RuntimeRefusal(7);
      }),
    );
    return failure === null ? null : failure.message;
  })
  .extend("originOfFailureCarryingCode", () => isEnvironmentFailure(new RuntimeRefusal("EROFS")))
  .extend("originOfFailureCarryingNoCode", () =>
    isEnvironmentFailure(new TypeError("cannot serialise a function")),
  )
  .extend("originOfThrownText", () => isEnvironmentFailure("EROFS"));

describe("readUnlessMissing", () => {
  it("a read that succeeds hands back what it read", ({ textOfPresentPath }) => {
    expect(textOfPresentPath).toBe("written");
  });

  it("a path that does not exist is an absence rather than a failure", ({ statOfAbsentPath }) => {
    expect(statOfAbsentPath).toBe(null);
  });

  it("a path routed through a file instead of a directory is an absence as well", ({
    statOfPathRoutedThroughFile,
  }) => {
    expect(statOfPathRoutedThroughFile).toBe(null);
  });

  it("a path that exists but cannot be read is raised instead of becoming an absence", ({
    messageOfRefusalCarryingWordedCode,
  }) => {
    expect(messageOfRefusalCarryingWordedCode).toBe("the runtime refused");
  });

  it("a failure the runtime did not raise is passed on untouched", ({
    messageOfFailureCarryingNoCode,
  }) => {
    expect(messageOfFailureCarryingNoCode).toBe(
      "the read failed for a reason the runtime did not name",
    );
  });

  it("a failure whose code is not a word is raised rather than becoming an absence", ({
    messageOfRefusalCarryingNumberedCode,
  }) => {
    expect(messageOfRefusalCarryingNumberedCode).toBe("the runtime refused");
  });
});

describe("isEnvironmentFailure", () => {
  it("a failure carrying a code came from the environment", ({ originOfFailureCarryingCode }) => {
    expect(originOfFailureCarryingCode).toBe(true);
  });

  it("a failure carrying no code came from our own declarations", ({
    originOfFailureCarryingNoCode,
  }) => {
    expect(originOfFailureCarryingNoCode).toBe(false);
  });

  it("a thrown value that is not an object carries nothing to classify", ({
    originOfThrownText,
  }) => {
    expect(originOfThrownText).toBe(false);
  });
});
