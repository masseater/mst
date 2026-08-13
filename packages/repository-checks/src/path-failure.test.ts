import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attempt } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { failureCodeOf, readUnlessMissing } from "./path-failure.ts";

class RuntimeRefusal extends Error {
  constructor(readonly code: string | number) {
    super("the runtime refused");
  }
}

describe("readUnlessMissing", () => {
  describe("a read that succeeds", () => {
    const it = test.extend("text", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "path-failure-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const path = join(root, "present.txt");
      writeFileSync(path, "written", "utf8");
      return readUnlessMissing(() => readFileSync(path, "utf8"));
    });

    it("hands back what it read", ({ text }) => {
      expect(text).toBe("written");
    });
  });

  describe("a path that does not exist", () => {
    const it = test.extend("stat", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "path-failure-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return readUnlessMissing(() => statSync(join(root, "absent.txt")));
    });

    it("is an absence rather than a failure", ({ stat }) => {
      expect(stat).toBe(null);
    });
  });

  describe("a path routed through a file instead of a directory", () => {
    const it = test.extend("stat", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "path-failure-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const path = join(root, "present.txt");
      writeFileSync(path, "written", "utf8");
      return readUnlessMissing(() => statSync(join(path, "below.txt")));
    });

    it("is an absence as well", ({ stat }) => {
      expect(stat).toBe(null);
    });
  });

  describe("a path that exists but cannot be read", () => {
    const it = test.extend("message", () => {
      const [failure] = attempt<unknown, Error>(() =>
        readUnlessMissing(() => {
          throw new RuntimeRefusal("EACCES");
        }),
      );
      return failure === null ? null : failure.message;
    });

    it("is raised instead of becoming an absence", ({ message }) => {
      expect(message).toBe("the runtime refused");
    });
  });

  describe("a failure the runtime did not raise", () => {
    const it = test.extend("message", () => {
      const [failure] = attempt<unknown, Error>(() =>
        readUnlessMissing(() => {
          throw new Error("the read failed for a reason the runtime did not name");
        }),
      );
      return failure === null ? null : failure.message;
    });

    it("is passed on untouched", ({ message }) => {
      expect(message).toBe("the read failed for a reason the runtime did not name");
    });
  });

  describe("a failure whose code is not a word", () => {
    const it = test.extend("message", () => {
      const [failure] = attempt<unknown, Error>(() =>
        readUnlessMissing(() => {
          throw new RuntimeRefusal(7);
        }),
      );
      return failure === null ? null : failure.message;
    });

    it("is raised rather than becoming an absence", ({ message }) => {
      expect(message).toBe("the runtime refused");
    });
  });
});

describe("failureCodeOf", () => {
  describe("a failure carrying a worded code", () => {
    const it = test.extend("code", () => failureCodeOf(new RuntimeRefusal("EROFS")));

    it("hands the code back", ({ code }) => {
      expect(code).toBe("EROFS");
    });
  });

  describe("a failure carrying no code", () => {
    const it = test.extend("code", () =>
      failureCodeOf(new TypeError("cannot serialise a function")));

    it("has nothing to hand back", ({ code }) => {
      expect(code).toBe(null);
    });
  });

  describe("a thrown value that is not an object", () => {
    const it = test.extend("code", () => failureCodeOf("EROFS"));

    it("carries nothing to classify", ({ code }) => {
      expect(code).toBe(null);
    });
  });
});
