import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  externalRecordKeyOf,
  externalRecordOf,
  MAX_INLINE_RECORD_LINES,
  recordLineCountOf,
} from "./snapshot-records.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-snapshot-records-"));

const writeRecordFixture = (name: string, records: string): string => {
  const directory = join(fixtureDir, name);
  mkdirSync(join(directory, "__snapshots__"), { recursive: true });
  writeFileSync(
    join(directory, "__snapshots__", "subject.test.ts.snap"),
    `// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html\n\n${records}`,
  );
  return join(directory, "subject.test.ts");
};

const plainRecords = writeRecordFixture(
  "plain",
  [
    'exports[`outer > names a behaviour 1`] = `"alpha"`;',
    "",
    "exports[`outer > names a behaviour 2`] = `",
    "{",
    '  "alpha": 1,',
    "}",
    "`;",
    "",
  ].join("\n"),
);

const escapedRecords = writeRecordFixture(
  "escaped",
  [
    "exports[`outer > carries delimiters 1`] = `",
    '"line one',
    "exports[\\`decoy > key 1\\`] = \\`tricked\\`;",
    'line three"',
    "`;",
    "",
    'exports[`outer > after the decoy 1`] = `"beta"`;',
    "",
  ].join("\n"),
);

const withoutRecordFile = join(fixtureDir, "absent", "subject.test.ts");

describe("dont-review-it/spec-syntax/snapshot-records", () => {
  test("a key joins the enclosing titles and ends with the ordinal", () => {
    expect(externalRecordKeyOf(["outer", "names a behaviour"], 2)).toBe(
      "outer > names a behaviour 2",
    );
  });

  test("a record written on one line is read back whole", () => {
    expect(externalRecordOf(plainRecords, "outer > names a behaviour 1")).toBe('"alpha"');
  });

  test("a record written across lines keeps the padding the runner wrote", () => {
    expect(externalRecordOf(plainRecords, "outer > names a behaviour 2")).toBe(
      '\n{\n  "alpha": 1,\n}\n',
    );
  });

  test("a key the file does not carry reads as no record", () => {
    expect(externalRecordOf(plainRecords, "outer > some other behaviour 1")).toBe(null);
  });

  test("a spec with no record file reads as no record", () => {
    expect(externalRecordOf(withoutRecordFile, "outer > names a behaviour 1")).toBe(null);
  });

  test("an escaped delimiter inside a record does not end the record", () => {
    expect(externalRecordOf(escapedRecords, "outer > carries delimiters 1")).toBe(
      '\n"line one\nexports[`decoy > key 1`] = `tricked`;\nline three"\n',
    );
  });

  test("a record carrying a decoy key does not hide the record that follows it", () => {
    expect(externalRecordOf(escapedRecords, "outer > after the decoy 1")).toBe('"beta"');
    expect(externalRecordOf(escapedRecords, "decoy > key 1")).toBe(null);
  });

  test("a record written on one line counts as one line", () => {
    expect(recordLineCountOf('"alpha"')).toBe(1);
  });

  test("an empty record counts as one line", () => {
    expect(recordLineCountOf("")).toBe(1);
  });

  test("the padding the runner adds around a multi line record is not counted", () => {
    expect(recordLineCountOf('\n{\n  "alpha": 1,\n}\n')).toBe(3);
  });

  test("a record carrying carriage returns counts the same as one without them", () => {
    expect(recordLineCountOf('\r\n{\r\n  "alpha": 1,\r\n}\r\n')).toBe(3);
  });

  test("the shared budget is the one both placement rules read", () => {
    expect(MAX_INLINE_RECORD_LINES).toBe(12);
  });
});
