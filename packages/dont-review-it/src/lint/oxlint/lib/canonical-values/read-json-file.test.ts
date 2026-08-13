import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attempt } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { readJsonFile } from "./read-json-file.ts";

const TRUNCATED_JSON_DIRECTORY = join(tmpdir(), "read-json-file-truncated");

const FOREIGN_TEXT_DIRECTORY = join(tmpdir(), "read-json-file-foreign-text");

describe("readJsonFile", () => {
  describe("a manifest that parses", () => {
    const it = test.extend("manifest", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-json-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "package.json"), '{ "name": "order" }', "utf8");
      return readJsonFile(join(root, "package.json"));
    });

    it("hands back what it declares", ({ manifest }) => {
      expect(manifest).toStrictEqual({ name: "order" });
    });
  });

  describe("a manifest that is not there", () => {
    const it = test.extend("manifest", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "read-json-file-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return readJsonFile(join(root, "package.json"));
    });

    it("is an absence", ({ manifest }) => {
      expect(manifest).toBe(null);
    });
  });

  describe("a manifest cut short", () => {
    const it = test.extend("failureMessage", ({}, { onCleanup }) => {
      mkdirSync(TRUNCATED_JSON_DIRECTORY, { recursive: true });
      onCleanup(() => {
        rmSync(TRUNCATED_JSON_DIRECTORY, { recursive: true, force: true });
      });
      writeFileSync(join(TRUNCATED_JSON_DIRECTORY, "package.json"), '{ "name": ', "utf8");
      const [failure] = attempt<unknown, Error>(() =>
        readJsonFile(join(TRUNCATED_JSON_DIRECTORY, "package.json")),
      );
      return failure === null ? null : failure.message;
    });

    it("is raised rather than reported as absent", ({ failureMessage }) => {
      expect(failureMessage).toBe(
        `${join(TRUNCATED_JSON_DIRECTORY, "package.json")} exists but does not parse as JSON`,
      );
    });
  });

  describe("a manifest holding text that is no JSON at all", () => {
    const it = test.extend("failureMessage", ({}, { onCleanup }) => {
      mkdirSync(FOREIGN_TEXT_DIRECTORY, { recursive: true });
      onCleanup(() => {
        rmSync(FOREIGN_TEXT_DIRECTORY, { recursive: true, force: true });
      });
      writeFileSync(join(FOREIGN_TEXT_DIRECTORY, "package.json"), "not json at all", "utf8");
      const [failure] = attempt<unknown, Error>(() =>
        readJsonFile(join(FOREIGN_TEXT_DIRECTORY, "package.json")),
      );
      return failure === null ? null : failure.message;
    });

    it("is raised the same way", ({ failureMessage }) => {
      expect(failureMessage).toBe(
        `${join(FOREIGN_TEXT_DIRECTORY, "package.json")} exists but does not parse as JSON`,
      );
    });
  });
});
