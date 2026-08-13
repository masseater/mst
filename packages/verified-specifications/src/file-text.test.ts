import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { fileTextOrNull } from "./file-text.ts";

describe("fileTextOrNull", () => {
  describe("a file that is there", () => {
    const it = test.extend("theTextOfAFileThatIsThere", async ({}, { onCleanup }) => {
      const directory = await mkdtemp(join(tmpdir(), "verified-specifications-"));
      onCleanup(async () => rm(directory, { recursive: true, force: true }));
      await writeFile(join(directory, "present.txt"), "content", "utf-8");
      return fileTextOrNull(join(directory, "present.txt"));
    });

    it("hands back the text written in it", ({ theTextOfAFileThatIsThere }) => {
      expect(theTextOfAFileThatIsThere).toBe("content");
    });
  });

  describe("a file that is not there", () => {
    const it = test.extend("theTextOfAFileThatIsNotThere", async ({}, { onCleanup }) => {
      const directory = await mkdtemp(join(tmpdir(), "verified-specifications-"));
      onCleanup(async () => rm(directory, { recursive: true, force: true }));
      return fileTextOrNull(join(directory, "absent.txt"));
    });

    it("reads the absence as nothing to read", ({ theTextOfAFileThatIsNotThere }) => {
      expect(theTextOfAFileThatIsNotThere).toBe(null);
    });
  });

  describe("a path that descends through a file", () => {
    const it = test.extend("theTextOfAPathBelowAFile", async ({}, { onCleanup }) => {
      const directory = await mkdtemp(join(tmpdir(), "verified-specifications-"));
      onCleanup(async () => rm(directory, { recursive: true, force: true }));
      await writeFile(join(directory, "present.txt"), "content", "utf-8");
      return fileTextOrNull(join(directory, "present.txt", "nested"));
    });

    it("reads the missing descent as nothing to read", ({ theTextOfAPathBelowAFile }) => {
      expect(theTextOfAPathBelowAFile).toBe(null);
    });
  });

  describe("a path that names a directory", () => {
    const it = test.extend("theFailureOfReadingADirectory", async ({}, { onCleanup }) => {
      const directory = await mkdtemp(join(tmpdir(), "verified-specifications-"));
      onCleanup(async () => rm(directory, { recursive: true, force: true }));
      try {
        return await fileTextOrNull(directory);
      } catch (failure) {
        return failure instanceof Error && "code" in failure ? failure.code : failure;
      }
    });

    it("surfaces the failure instead of reading it as absence", ({
      theFailureOfReadingADirectory,
    }) => {
      expect(theFailureOfReadingADirectory).toBe("EISDIR");
    });
  });
});
