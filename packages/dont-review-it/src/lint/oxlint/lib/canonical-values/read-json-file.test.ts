import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { readJsonFile } from "./read-json-file.ts";

const createFixtureDirectory = (): string => {
  const root = mkdtempSync(join(tmpdir(), "read-json-file-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return root;
};

const writeManifest = (root: string, writtenText: string): string => {
  const path = join(root, "package.json");
  writeFileSync(path, writtenText, "utf8");
  return path;
};

describe("readJsonFile", () => {
  test("a manifest that parses hands back what it declares", () => {
    const root = createFixtureDirectory();
    const path = writeManifest(root, '{ "name": "order" }');

    expect(readJsonFile(path)).toStrictEqual({ name: "order" });
  });

  test("a manifest that is not there is an absence", () => {
    const root = createFixtureDirectory();

    expect(readJsonFile(join(root, "package.json"))).toBe(null);
  });

  test("a manifest that is there but does not parse is raised rather than reported as absent", () => {
    const root = createFixtureDirectory();
    const path = writeManifest(root, '{ "name": ');

    expect(() => readJsonFile(path)).toThrow("does not parse as JSON");
  });

  test("the raised failure names the file that could not be parsed", () => {
    const root = createFixtureDirectory();
    const path = writeManifest(root, "not json at all");

    expect(() => readJsonFile(path)).toThrow(path);
  });
});
