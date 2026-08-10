import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { isEnvironmentFailure, readUnlessMissing } from "./path-failure.ts";

const createFixtureDirectory = (): string => {
  const root = mkdtempSync(join(tmpdir(), "path-failure-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return root;
};

const failWithoutCode = (): never => {
  throw new Error("the read failed for a reason the runtime did not name");
};

class RuntimeRefusal extends Error {
  constructor(readonly code: string | number) {
    super("the runtime refused");
  }
}

const failWithCode = (): never => {
  throw new RuntimeRefusal("EACCES");
};

const failWithNumberedCode = (): never => {
  throw new RuntimeRefusal(7);
};

describe("readUnlessMissing", () => {
  test("a read that succeeds hands back what it read", () => {
    const root = createFixtureDirectory();
    const path = join(root, "present.txt");
    writeFileSync(path, "written", "utf8");

    expect(readUnlessMissing(() => readFileSync(path, "utf8"))).toBe("written");
  });

  test("a path that does not exist is an absence rather than a failure", () => {
    const root = createFixtureDirectory();

    expect(readUnlessMissing(() => statSync(join(root, "absent.txt")))).toBe(null);
  });

  test("a path routed through a file instead of a directory is an absence as well", () => {
    const root = createFixtureDirectory();
    const path = join(root, "present.txt");
    writeFileSync(path, "written", "utf8");

    expect(readUnlessMissing(() => statSync(join(path, "below.txt")))).toBe(null);
  });

  test("a path that exists but cannot be read is raised instead of becoming an absence", () => {
    expect(() => readUnlessMissing(failWithCode)).toThrow("the runtime refused");
  });

  test("a failure the runtime did not raise is passed on untouched", () => {
    expect(() => readUnlessMissing(failWithoutCode)).toThrow(
      "the read failed for a reason the runtime did not name",
    );
  });

  test("a failure whose code is not a word is raised rather than becoming an absence", () => {
    expect(() => readUnlessMissing(failWithNumberedCode)).toThrow("the runtime refused");
  });

  test("a failure carrying a code came from the environment", () => {
    expect(isEnvironmentFailure(new RuntimeRefusal("EROFS"))).toBe(true);
  });

  test("a failure carrying no code came from our own declarations", () => {
    expect(isEnvironmentFailure(new TypeError("cannot serialise a function"))).toBe(false);
  });

  test("a thrown value that is not an object carries nothing to classify", () => {
    expect(isEnvironmentFailure("EROFS")).toBe(false);
  });
});
