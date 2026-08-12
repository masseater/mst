import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attempt } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { readJsonFile } from "./read-json-file.ts";

const TRUNCATED_JSON_DIRECTORY = join(tmpdir(), "read-json-file-truncated");

const FOREIGN_TEXT_DIRECTORY = join(tmpdir(), "read-json-file-foreign-text");

const it = test
  .extend("declaredManifest", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-json-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "package.json"), '{ "name": "order" }', "utf8");
    return readJsonFile(join(root, "package.json"));
  })
  .extend("absentManifest", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "read-json-file-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return readJsonFile(join(root, "package.json"));
  })
  .extend("failureOnTruncatedJson", ({}, { onCleanup }) => {
    mkdirSync(TRUNCATED_JSON_DIRECTORY, { recursive: true });
    onCleanup(() => {
      rmSync(TRUNCATED_JSON_DIRECTORY, { recursive: true, force: true });
    });
    writeFileSync(join(TRUNCATED_JSON_DIRECTORY, "package.json"), '{ "name": ', "utf8");
    const [failure] = attempt<unknown, Error>(() =>
      readJsonFile(join(TRUNCATED_JSON_DIRECTORY, "package.json")),
    );
    return failure === null ? null : failure.message;
  })
  .extend("failureOnForeignText", ({}, { onCleanup }) => {
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

describe("readJsonFile", () => {
  it("a manifest that parses hands back what it declares", ({ declaredManifest }) => {
    expect(declaredManifest).toStrictEqual({ name: "order" });
  });

  it("a manifest that is not there is an absence", ({ absentManifest }) => {
    expect(absentManifest).toBe(null);
  });

  it("a manifest cut short is raised rather than reported as absent", ({
    failureOnTruncatedJson,
  }) => {
    expect(failureOnTruncatedJson).toBe(
      `${join(TRUNCATED_JSON_DIRECTORY, "package.json")} exists but does not parse as JSON`,
    );
  });

  it("a manifest holding text that is no JSON at all is raised the same way", ({
    failureOnForeignText,
  }) => {
    expect(failureOnForeignText).toBe(
      `${join(FOREIGN_TEXT_DIRECTORY, "package.json")} exists but does not parse as JSON`,
    );
  });
});
