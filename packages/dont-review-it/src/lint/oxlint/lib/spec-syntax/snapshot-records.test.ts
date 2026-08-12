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

const it = test
  .extend("keyOfATitlePathAndAnOrdinal", () =>
    externalRecordKeyOf(["outer", "names a behaviour"], 2))
  .extend("recordWrittenOnOneLine", () => {
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
  })
  .extend("recordWrittenAcrossLines", () => {
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
  })
  .extend("recordUnderAKeyTheFileDoesNotCarry", () => {
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
  })
  .extend("recordOfASpecWithNoRecordFile", () => {
    const directory = join(tmpdir(), "dont-review-it-snapshot-records", "absent");
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
    return externalRecordOf(join(directory, "subject.test.ts"), "outer > names a behaviour 1");
  })
  .extend("recordCarryingAnEscapedDelimiter", () => {
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
  })
  .extend("recordFollowingTheOneThatCarriesADecoyKey", () => {
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
  })
  .extend("recordUnderTheDecoyKey", () => {
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
  })
  .extend("lineCountOfARecordWrittenOnOneLine", () => recordLineCountOf('"alpha"'))
  .extend("lineCountOfAnEmptyRecord", () => recordLineCountOf(""))
  .extend("lineCountOfARecordWrittenAcrossLines", () =>
    recordLineCountOf('\n{\n  "alpha": 1,\n}\n'),
  )
  .extend("lineCountOfARecordCarryingCarriageReturns", () =>
    recordLineCountOf('\r\n{\r\n  "alpha": 1,\r\n}\r\n'),
  )
  .extend("theSharedBudgetForAnInlineRecord", () => MAX_INLINE_RECORD_LINES);

describe("dont-review-it/spec-syntax/snapshot-records", () => {
  it("a key joins the enclosing titles and ends with the ordinal", ({
    keyOfATitlePathAndAnOrdinal,
  }) => {
    expect(keyOfATitlePathAndAnOrdinal).toBe("outer > names a behaviour 2");
  });

  it("a record written on one line is read back whole", ({ recordWrittenOnOneLine }) => {
    expect(recordWrittenOnOneLine).toBe('"alpha"');
  });

  it("a record written across lines keeps the padding the runner wrote", ({
    recordWrittenAcrossLines,
  }) => {
    expect(recordWrittenAcrossLines).toBe('\n{\n  "alpha": 1,\n}\n');
  });

  it("a key the file does not carry reads as no record", ({
    recordUnderAKeyTheFileDoesNotCarry,
  }) => {
    expect(recordUnderAKeyTheFileDoesNotCarry).toBe(null);
  });

  it("a spec with no record file reads as no record", ({ recordOfASpecWithNoRecordFile }) => {
    expect(recordOfASpecWithNoRecordFile).toBe(null);
  });

  it("an escaped delimiter inside a record does not end the record", ({
    recordCarryingAnEscapedDelimiter,
  }) => {
    expect(recordCarryingAnEscapedDelimiter).toBe(
      '\n"line one\nexports[`decoy > key 1`] = `tricked`;\nline three"\n',
    );
  });

  it("a record carrying a decoy key does not hide the record that follows it", ({
    recordFollowingTheOneThatCarriesADecoyKey,
  }) => {
    expect(recordFollowingTheOneThatCarriesADecoyKey).toBe('"beta"');
  });

  it("the decoy key inside a record is not a key of its own", ({ recordUnderTheDecoyKey }) => {
    expect(recordUnderTheDecoyKey).toBe(null);
  });

  it("a record written on one line counts as one line", ({
    lineCountOfARecordWrittenOnOneLine,
  }) => {
    expect(lineCountOfARecordWrittenOnOneLine).toBe(1);
  });

  it("an empty record counts as one line", ({ lineCountOfAnEmptyRecord }) => {
    expect(lineCountOfAnEmptyRecord).toBe(1);
  });

  it("the padding the runner adds around a multi line record is not counted", ({
    lineCountOfARecordWrittenAcrossLines,
  }) => {
    expect(lineCountOfARecordWrittenAcrossLines).toBe(3);
  });

  it("a record carrying carriage returns counts the same as one without them", ({
    lineCountOfARecordCarryingCarriageReturns,
  }) => {
    expect(lineCountOfARecordCarryingCarriageReturns).toBe(3);
  });

  it("the shared budget is the one both placement rules read", ({
    theSharedBudgetForAnInlineRecord,
  }) => {
    expect(theSharedBudgetForAnInlineRecord).toBe(12);
  });
});
