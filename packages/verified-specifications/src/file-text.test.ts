import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { fileTextOrNull } from "./file-text.ts";

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "verified-specifications-"));
  onTestFinished(async () => rm(directory, { recursive: true, force: true }));
  return directory;
};

describe("fileTextOrNull", () => {
  test("returns the text of a file that exists", async () => {
    const directory = await temporaryDirectory();
    await writeFile(join(directory, "present.txt"), "content", "utf-8");
    await expect(fileTextOrNull(join(directory, "present.txt"))).resolves.toBe("content");
  });

  test("returns null for a file that does not exist", async () => {
    const directory = await temporaryDirectory();
    await expect(fileTextOrNull(join(directory, "absent.txt"))).resolves.toBeNull();
  });

  test("returns null for a path that descends through a file", async () => {
    const directory = await temporaryDirectory();
    await writeFile(join(directory, "present.txt"), "content", "utf-8");
    await expect(fileTextOrNull(join(directory, "present.txt", "nested"))).resolves.toBeNull();
  });

  test("surfaces a failure that is not absence", async () => {
    const directory = await temporaryDirectory();
    await expect(fileTextOrNull(directory)).rejects.toThrow("EISDIR");
  });
});
