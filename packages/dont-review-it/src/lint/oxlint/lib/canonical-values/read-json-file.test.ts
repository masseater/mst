import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, expect, test } from "vite-plus/test";

import { readJsonFile } from "./read-json-file.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "read-json-file-"));

const fixtureWith = (name: string, text: string): string => {
  const path = join(fixtureDir, name);
  writeFileSync(path, text);
  return path;
};

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

test("a file holding json is read as the value it spells", () => {
  expect(readJsonFile(fixtureWith("manifest.json", '{"name":"order"}'))).toStrictEqual({
    name: "order",
  });
});

test("a file that is not json reads as nothing rather than throwing", () => {
  expect(readJsonFile(fixtureWith("broken.json", "{name: order"))).toBe(null);
});

test("a file that is not there reads as nothing", () => {
  expect(readJsonFile(join(fixtureDir, "missing.json"))).toBe(null);
});
