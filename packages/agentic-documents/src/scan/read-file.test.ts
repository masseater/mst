import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import {
  directoryNamesIn,
  nonEmptyStringOrNull,
  readJsonObjectOrNull,
  readTextOrNull,
  statOrNull,
} from "./read-file.ts";

const UNREADABLE_PATH = "\0";

describe("read-file", () => {
  const sandbox = (): string => {
    const root = mkdtempSync(join(tmpdir(), "read-file-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return root;
  };

  const fileIn = (
    root: string,
    { name, text }: { readonly name: string; readonly text: string },
  ): string => {
    const path = join(root, name);
    writeFileSync(path, text, "utf8");
    return path;
  };

  test("a path that is there is described", async () => {
    const root = sandbox();

    expect(
      (await statOrNull(fileIn(root, { name: "AGENTS.md", text: "# root\n" })))?.isFile(),
    ).toBe(true);
  });

  test("a path that is not there is an absence", async () => {
    expect(await statOrNull(join(sandbox(), "missing.md"))).toBe(null);
  });

  test("a path routed through a file instead of a directory is an absence as well", async () => {
    const root = sandbox();
    const path = fileIn(root, { name: "AGENTS.md", text: "# root\n" });

    expect(await statOrNull(join(path, "below.md"))).toBe(null);
  });

  test("a path the runtime refuses outright is raised", async () => {
    await expect(statOrNull(UNREADABLE_PATH)).rejects.toThrow("null bytes");
  });

  test("a file that is there is read", async () => {
    const root = sandbox();

    expect(await readTextOrNull(fileIn(root, { name: "AGENTS.md", text: "# root\n" }))).toBe(
      "# root\n",
    );
  });

  test("a file that is not there reads as an absence", async () => {
    expect(await readTextOrNull(join(sandbox(), "missing.md"))).toBe(null);
  });

  test("a read the runtime refuses outright is raised", async () => {
    await expect(readTextOrNull(sandbox())).rejects.toThrow("illegal operation on a directory");
  });

  test("the directories of a directory are named", async () => {
    const root = sandbox();
    mkdirSync(join(root, "packages"));
    fileIn(root, { name: "AGENTS.md", text: "# root\n" });

    expect(await directoryNamesIn(root)).toStrictEqual(["packages"]);
  });

  test("a directory that is not there names nothing", async () => {
    expect(await directoryNamesIn(join(sandbox(), "missing"))).toStrictEqual([]);
  });

  test("a listing the runtime refuses outright is raised", async () => {
    await expect(directoryNamesIn(UNREADABLE_PATH)).rejects.toThrow("null bytes");
  });

  test("a manifest that parses into an object is read as that object", async () => {
    const root = sandbox();

    expect(
      await readJsonObjectOrNull(fileIn(root, { name: "package.json", text: '{"name":"user"}' })),
    ).toStrictEqual({ name: "user" });
  });

  test("a manifest that is not there is an absence", async () => {
    expect(await readJsonObjectOrNull(join(sandbox(), "package.json"))).toBe(null);
  });

  test("a manifest that parses into something other than an object is an absence", async () => {
    const root = sandbox();

    expect(await readJsonObjectOrNull(fileIn(root, { name: "list.json", text: "[1]" }))).toBe(null);
    expect(await readJsonObjectOrNull(fileIn(root, { name: "null.json", text: "null" }))).toBe(
      null,
    );
    expect(await readJsonObjectOrNull(fileIn(root, { name: "name.json", text: '"user"' }))).toBe(
      null,
    );
  });

  test("a value that is a word is handed back trimmed", () => {
    expect(nonEmptyStringOrNull("  user  ")).toBe("user");
  });

  test("a value that is not a word, or is only spaces, is an absence", () => {
    expect(nonEmptyStringOrNull(1)).toBe(null);
    expect(nonEmptyStringOrNull("   ")).toBe(null);
  });
});
