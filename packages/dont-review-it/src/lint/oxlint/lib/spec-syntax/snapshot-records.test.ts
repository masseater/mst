import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  externalRecordKeyOf,
  externalRecordOf,
  MAX_INLINE_RECORD_LINES,
  recordLineCountOf,
} from "./snapshot-records.ts";

describe("externalRecordKeyOf", () => {
  describe("a title path and an ordinal", () => {
    const it = test.extend("recordKey", () =>
      externalRecordKeyOf(["outer", "names a behaviour"], 2));

    it("joins the enclosing titles and ends with the ordinal", ({ recordKey }) => {
      expect(recordKey).toBe("outer > names a behaviour 2");
    });
  });
});

describe("externalRecordOf", () => {
  describe("a record written on one line", () => {
    const it = test.extend("storedSingleLineSnapshot", () => {
      const directory = join(tmpdir(), "dont-review-it-snapshot-records", "one-line");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(join(directory, "__snapshots__"), { recursive: true });
      writeFileSync(
        join(directory, "__snapshots__", "subject.test.ts.snap"),
        [
          "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html",
          "",
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
      return externalRecordOf(join(directory, "subject.test.ts"), "outer > names a behaviour 1");
    });

    it("is read back whole", ({ storedSingleLineSnapshot }) => {
      expect(storedSingleLineSnapshot).toBe('"alpha"');
    });
  });

  describe("a record written across lines", () => {
    const it = test.extend("storedMultiLineSnapshot", () => {
      const directory = join(tmpdir(), "dont-review-it-snapshot-records", "across-lines");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(join(directory, "__snapshots__"), { recursive: true });
      writeFileSync(
        join(directory, "__snapshots__", "subject.test.ts.snap"),
        [
          "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html",
          "",
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
      return externalRecordOf(join(directory, "subject.test.ts"), "outer > names a behaviour 2");
    });

    it("keeps the padding the runner wrote", ({ storedMultiLineSnapshot }) => {
      expect(storedMultiLineSnapshot).toBe('\n{\n  "alpha": 1,\n}\n');
    });
  });

  describe("a key the file does not carry", () => {
    const it = test.extend("snapshotForAbsentKey", () => {
      const directory = join(tmpdir(), "dont-review-it-snapshot-records", "other-key");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(join(directory, "__snapshots__"), { recursive: true });
      writeFileSync(
        join(directory, "__snapshots__", "subject.test.ts.snap"),
        [
          "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html",
          "",
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
      return externalRecordOf(join(directory, "subject.test.ts"), "outer > some other behaviour 1");
    });

    it("reads as no record", ({ snapshotForAbsentKey }) => {
      expect(snapshotForAbsentKey).toBe(null);
    });
  });

  describe("a spec with no record file", () => {
    const it = test.extend("snapshotForSpecWithoutRecordFile", () => {
      const directory = join(tmpdir(), "dont-review-it-snapshot-records", "absent");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(directory, { recursive: true });
      return externalRecordOf(join(directory, "subject.test.ts"), "outer > names a behaviour 1");
    });

    it("reads as no record", ({ snapshotForSpecWithoutRecordFile }) => {
      expect(snapshotForSpecWithoutRecordFile).toBe(null);
    });
  });

  describe("an escaped delimiter inside a record", () => {
    const it = test.extend("snapshotCarryingEscapedDelimiters", () => {
      const directory = join(tmpdir(), "dont-review-it-snapshot-records", "escaped");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(join(directory, "__snapshots__"), { recursive: true });
      writeFileSync(
        join(directory, "__snapshots__", "subject.test.ts.snap"),
        [
          "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html",
          "",
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
      return externalRecordOf(join(directory, "subject.test.ts"), "outer > carries delimiters 1");
    });

    it("does not end the record", ({ snapshotCarryingEscapedDelimiters }) => {
      expect(snapshotCarryingEscapedDelimiters).toBe(
        '\n"line one\nexports[`decoy > key 1`] = `tricked`;\nline three"\n',
      );
    });
  });

  describe("a record carrying a decoy key", () => {
    const it = test.extend("snapshotAfterTheDecoy", () => {
      const directory = join(tmpdir(), "dont-review-it-snapshot-records", "after-decoy");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(join(directory, "__snapshots__"), { recursive: true });
      writeFileSync(
        join(directory, "__snapshots__", "subject.test.ts.snap"),
        [
          "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html",
          "",
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
      return externalRecordOf(join(directory, "subject.test.ts"), "outer > after the decoy 1");
    });

    it("does not hide the record that follows it", ({ snapshotAfterTheDecoy }) => {
      expect(snapshotAfterTheDecoy).toBe('"beta"');
    });
  });

  describe("the decoy key inside a record", () => {
    const it = test.extend("snapshotForDecoyKey", () => {
      const directory = join(tmpdir(), "dont-review-it-snapshot-records", "decoy");
      rmSync(directory, { recursive: true, force: true });
      mkdirSync(join(directory, "__snapshots__"), { recursive: true });
      writeFileSync(
        join(directory, "__snapshots__", "subject.test.ts.snap"),
        [
          "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html",
          "",
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
      return externalRecordOf(join(directory, "subject.test.ts"), "decoy > key 1");
    });

    it("is not a key of its own", ({ snapshotForDecoyKey }) => {
      expect(snapshotForDecoyKey).toBe(null);
    });
  });
});

describe("recordLineCountOf", () => {
  describe("a record written on one line", () => {
    const it = test.extend("recordLineCount", () => recordLineCountOf('"alpha"'));

    it("counts as one line", ({ recordLineCount }) => {
      expect(recordLineCount).toBe(1);
    });
  });

  describe("an empty record", () => {
    const it = test.extend("recordLineCount", () => recordLineCountOf(""));

    it("counts as one line", ({ recordLineCount }) => {
      expect(recordLineCount).toBe(1);
    });
  });

  describe("a record written across lines", () => {
    const it = test.extend("recordLineCount", () => recordLineCountOf('\n{\n  "alpha": 1,\n}\n'));

    it("does not count the padding the runner adds around it", ({ recordLineCount }) => {
      expect(recordLineCount).toBe(3);
    });
  });

  describe("a record carrying carriage returns", () => {
    const it = test.extend("recordLineCount", () =>
      recordLineCountOf('\r\n{\r\n  "alpha": 1,\r\n}\r\n'));

    it("counts the same as one without them", ({ recordLineCount }) => {
      expect(recordLineCount).toBe(3);
    });
  });
});

describe("MAX_INLINE_RECORD_LINES", () => {
  describe("the budget both placement rules read", () => {
    const it = test.extend("inlineRecordBudget", () => MAX_INLINE_RECORD_LINES);

    it("is the one shared number", ({ inlineRecordBudget }) => {
      expect(inlineRecordBudget).toBe(12);
    });
  });
});
