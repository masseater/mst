import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attemptAsync } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import {
  directoryNamesIn,
  nonEmptyStringOrNull,
  readJsonObjectOrNull,
  readTextOrNull,
  statOrNull,
} from "./read-file.ts";

const UNREADABLE_PATH = "\0";

describe("statOrNull", () => {
  describe("a path that is there", () => {
    const it = test.extend("fileVerdict", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const documentPath = join(root, "AGENTS.md");
      writeFileSync(documentPath, "# root\n", "utf8");
      const described = await statOrNull(documentPath);
      return described?.isFile();
    });

    it("is described", ({ fileVerdict }) => {
      expect(fileVerdict).toBe(true);
    });
  });

  describe("a path that is not there", () => {
    const it = test.extend("description", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return statOrNull(join(root, "missing.md"));
    });

    it("is an absence", ({ description }) => {
      expect(description).toBe(null);
    });
  });

  describe("a path routed through a file instead of a directory", () => {
    const it = test.extend("description", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const documentPath = join(root, "AGENTS.md");
      writeFileSync(documentPath, "# root\n", "utf8");
      return statOrNull(join(documentPath, "below.md"));
    });

    it("is an absence as well", ({ description }) => {
      expect(description).toBe(null);
    });
  });

  describe("a path the runtime refuses outright", () => {
    const it = test.extend("failureMessage", async () => {
      const [failure] = await attemptAsync<unknown, Error>(() => statOrNull(UNREADABLE_PATH));
      return failure === null ? null : failure.message;
    });

    it("is raised", ({ failureMessage }) => {
      expect(failureMessage).toBe(
        "The argument 'path' must be a string, Uint8Array, or URL without null bytes. Received '\\x00'",
      );
    });
  });
});

describe("readTextOrNull", () => {
  describe("a file that is there", () => {
    const it = test.extend("documentText", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const documentPath = join(root, "AGENTS.md");
      writeFileSync(documentPath, "# root\n", "utf8");
      return readTextOrNull(documentPath);
    });

    it("is read", ({ documentText }) => {
      expect(documentText).toBe("# root\n");
    });
  });

  describe("a file that is not there", () => {
    const it = test.extend("missingDocumentText", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return readTextOrNull(join(root, "missing.md"));
    });

    it("reads as an absence", ({ missingDocumentText }) => {
      expect(missingDocumentText).toBe(null);
    });
  });

  describe("a read the runtime refuses outright", () => {
    const it = test.extend("failureMessage", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const [failure] = await attemptAsync<unknown, Error>(() => readTextOrNull(root));
      return failure === null ? null : failure.message;
    });

    it("is raised", ({ failureMessage }) => {
      expect(failureMessage).toBe("EISDIR: illegal operation on a directory, read");
    });
  });
});

describe("directoryNamesIn", () => {
  describe("a directory holding a directory beside a file", () => {
    const it = test.extend("directoryNames", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages"));
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      return directoryNamesIn(root);
    });

    it("names the directories alone", ({ directoryNames }) => {
      expect(directoryNames).toStrictEqual(["packages"]);
    });
  });

  describe("a directory that is not there", () => {
    const it = test.extend("directoryNamesUnderMissingRoot", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return directoryNamesIn(join(root, "missing"));
    });

    it("names nothing", ({ directoryNamesUnderMissingRoot }) => {
      expect(directoryNamesUnderMissingRoot).toStrictEqual([]);
    });
  });

  describe("a listing the runtime refuses outright", () => {
    const it = test.extend("failureMessage", async () => {
      const [failure] = await attemptAsync<unknown, Error>(() => directoryNamesIn(UNREADABLE_PATH));
      return failure === null ? null : failure.message;
    });

    it("is raised", ({ failureMessage }) => {
      expect(failureMessage).toBe(
        "The argument 'path' must be a string, Uint8Array, or URL without null bytes. Received '\\x00'",
      );
    });
  });
});

describe("readJsonObjectOrNull", () => {
  describe("a manifest that parses into an object", () => {
    const it = test.extend("manifest", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const manifestPath = join(root, "package.json");
      writeFileSync(manifestPath, '{"name":"user"}', "utf8");
      return readJsonObjectOrNull(manifestPath);
    });

    it("is read as that object", ({ manifest }) => {
      expect(manifest).toStrictEqual({ name: "user" });
    });
  });

  describe("a manifest that is not there", () => {
    const it = test.extend("manifest", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return readJsonObjectOrNull(join(root, "package.json"));
    });

    it("is an absence", ({ manifest }) => {
      expect(manifest).toBe(null);
    });
  });

  describe("a manifest that parses into a list", () => {
    const it = test.extend("manifest", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const manifestPath = join(root, "list.json");
      writeFileSync(manifestPath, "[1]", "utf8");
      return readJsonObjectOrNull(manifestPath);
    });

    it("is an absence", ({ manifest }) => {
      expect(manifest).toBe(null);
    });
  });

  describe("a manifest that parses into nothing at all", () => {
    const it = test.extend("manifest", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const manifestPath = join(root, "null.json");
      writeFileSync(manifestPath, "null", "utf8");
      return readJsonObjectOrNull(manifestPath);
    });

    it("is an absence", ({ manifest }) => {
      expect(manifest).toBe(null);
    });
  });

  describe("a manifest that parses into a word", () => {
    const it = test.extend("manifest", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const manifestPath = join(root, "name.json");
      writeFileSync(manifestPath, '"user"', "utf8");
      return readJsonObjectOrNull(manifestPath);
    });

    it("is an absence", ({ manifest }) => {
      expect(manifest).toBe(null);
    });
  });
});

describe("nonEmptyStringOrNull", () => {
  describe("a word carrying spaces around it", () => {
    const it = test.extend("word", () => nonEmptyStringOrNull("  user  "));

    it("is handed back trimmed", ({ word }) => {
      expect(word).toBe("user");
    });
  });

  describe("a value that is not a word", () => {
    const it = test.extend("word", () => nonEmptyStringOrNull(1));

    it("is an absence", ({ word }) => {
      expect(word).toBe(null);
    });
  });

  describe("a value that is only spaces", () => {
    const it = test.extend("word", () => nonEmptyStringOrNull("   "));

    it("is an absence", ({ word }) => {
      expect(word).toBe(null);
    });
  });
});
