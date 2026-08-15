import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { range } from "es-toolkit";
import { describe } from "vite-plus/test";

import { noUndersizedExternalSnapshot } from "./no-undersized-external-snapshot--use-inline-snapshot.ts";

const fixtureDir = join(tmpdir(), "dont-review-it-no-undersized-external-snapshot");
rmSync(fixtureDir, { recursive: true, force: true });

const SPEC_FILE_NAME = "subject.test.ts";

const RECORD_HEADER = "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html\n\n";

const SCALAR_RECORD = '"alpha"';

const RECORD_OF_THREE_LINES = `\n${range(3)
  .map((at) => `line ${String(at)}`)
  .join("\n")}\n`;

const RECORD_AT_THE_BUDGET = `\n${range(12)
  .map((at) => `line ${String(at)}`)
  .join("\n")}\n`;

const RECORD_PAST_THE_BUDGET = `\n${range(13)
  .map((at) => `line ${String(at)}`)
  .join("\n")}\n`;

const smallRecord = join(fixtureDir, "small-record", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "small-record", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "small-record", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_OF_THREE_LINES}\`;\n`,
);

const atTheBudget = join(fixtureDir, "at-the-budget", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "at-the-budget", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "at-the-budget", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_AT_THE_BUDGET}\`;\n`,
);

const overTheBudget = join(fixtureDir, "over-the-budget", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "over-the-budget", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "over-the-budget", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_PAST_THE_BUDGET}\`;\n`,
);

const shiftedByInline = join(fixtureDir, "shifted-by-inline", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "shifted-by-inline", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "shifted-by-inline", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_PAST_THE_BUDGET}\`;\n\nexports[\`outer > names a behaviour 2\`] = \`${SCALAR_RECORD}\`;\n`,
);

const shiftedByFileRecord = join(fixtureDir, "shifted-by-file-record", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "shifted-by-file-record", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "shifted-by-file-record", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_PAST_THE_BUDGET}\`;\n\nexports[\`outer > names a behaviour 2\`] = \`${SCALAR_RECORD}\`;\n`,
);

const hintedRecord = join(fixtureDir, "hinted-record", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "hinted-record", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "hinted-record", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_PAST_THE_BUDGET}\`;\n\nexports[\`outer > names a behaviour > the hint 1\`] = \`${SCALAR_RECORD}\`;\n`,
);

const thrownRecord = join(fixtureDir, "thrown-record", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "thrown-record", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "thrown-record", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${SCALAR_RECORD}\`;\n`,
);

const tableRecords = join(fixtureDir, "table-records", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "table-records", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "table-records", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > scalar 1 1\`] = \`${SCALAR_RECORD}\`;\n\nexports[\`outer > scalar 2 1\`] = \`${SCALAR_RECORD}\`;\n`,
);

const partialTableRecords = join(fixtureDir, "partial-table-records", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "partial-table-records", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "partial-table-records", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > scalar 1 1\`] = \`${SCALAR_RECORD}\`;\n`,
);

const unrecordedKey = join(fixtureDir, "unrecorded-key", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "unrecorded-key", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "unrecorded-key", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > some other behaviour 1\`] = \`${SCALAR_RECORD}\`;\n`,
);

const splitTitles = join(fixtureDir, "split-titles", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "split-titles", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "split-titles", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${SCALAR_RECORD}\`;\n\nexports[\`outer names > a behaviour 1\`] = \`${SCALAR_RECORD}\`;\n`,
);

const hintAgainstPlainTitle = join(fixtureDir, "hint-against-plain-title", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "hint-against-plain-title", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "hint-against-plain-title", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > names a behaviour > the hint 1\`] = \`${SCALAR_RECORD}\`;\n\nexports[\`outer > names a behaviour the hint 1\`] = \`${SCALAR_RECORD}\`;\n`,
);

const manyCases = join(fixtureDir, "many-cases", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "many-cases", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "many-cases", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
  `${RECORD_HEADER}exports[\`outer > scalar 1 1\`] = \`${SCALAR_RECORD}\`;\n\nexports[\`outer > scalar 2 1\`] = \`${SCALAR_RECORD}\`;\n\nexports[\`outer > scalar 3 1\`] = \`${SCALAR_RECORD}\`;\n\nexports[\`outer > scalar 4 1\`] = \`${SCALAR_RECORD}\`;\n`,
);

const namedSuffixSpec = join(fixtureDir, "named-suffix", "subject.spec.ts");
mkdirSync(join(fixtureDir, "named-suffix", "__snapshots__"), { recursive: true });
writeFileSync(
  join(fixtureDir, "named-suffix", "__snapshots__", "subject.spec.ts.snap"),
  `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_OF_THREE_LINES}\`;\n`,
);

const withoutRecordFile = join(fixtureDir, "no-record-file", SPEC_FILE_NAME);
mkdirSync(join(fixtureDir, "no-record-file"), { recursive: true });

describe("dont-review-it/no-undersized-external-snapshot--use-inline-snapshot", () => {
  testLintRule(noUndersizedExternalSnapshot, {
    valid: [
      {
        name: "a file that is not a spec is left alone",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchSnapshot();\n  });\n});',
        filename: join(fixtureDir, "small-record", "subject.ts"),
      },
      {
        name: "a spec with no record file has nothing to measure",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchSnapshot();\n  });\n});',
        filename: withoutRecordFile,
      },
      {
        name: "a key the record file does not carry has nothing to measure",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchSnapshot();\n  });\n});',
        filename: unrecordedKey,
      },
      {
        name: "a record past the budget is already in the right place",
        documented: true,
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchSnapshot();\n  });\n});',
        filename: overTheBudget,
      },
      {
        name: "an inline record is the other rule's subject",
        documented: true,
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchInlineSnapshot(`"alpha"`);\n  });\n});',
        filename: smallRecord,
      },
      {
        name: "a file record is the counter's business and not this rule's",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchFileSnapshot("./subject.txt");\n  });\n});',
        filename: smallRecord,
      },
      {
        name: "a snapshot outside every test block resolves to no key",
        code: "expect(subject).toMatchSnapshot();",
        filename: smallRecord,
      },
      {
        name: "a table whose cases are not all recorded yet has nothing to measure",
        code: 'describe("outer", () => {\n  it.each([1, 2])("scalar %s", (value) => {\n    expect(value).toMatchSnapshot();\n  });\n});',
        filename: partialTableRecords,
      },
      {
        name: "a table written as a tagged template cannot be spelled out here and is left alone",
        code: 'describe("outer", () => {\n  it.each`a`("scalar $a", ({ a }) => {\n    expect(a).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
      },
      {
        name: "raising the budget past the record leaves it in place",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
        options: [{ maxLines: 2 }],
      },
      {
        name: "a snapshot matcher reached on a receiver that is no assertion is another API",
        code: "held.toMatchSnapshot();",
        filename: smallRecord,
      },
      {
        name: "a table declaration built by a bare call keeps the title it was written with",
        code: 'each([1])("scalar %s", (value) => {\n  expect(value).toMatchSnapshot();\n});',
        filename: smallRecord,
      },
      {
        name: "a member other than a table member keeps the title it was written with",
        code: 'it.notEach([1])("scalar %s", (value) => {\n  expect(value).toMatchSnapshot();\n});',
        filename: smallRecord,
      },
      {
        name: "a table member handed no table keeps the title it was written with",
        code: 'it.each()("scalar %s", (value) => {\n  expect(value).toMatchSnapshot();\n});',
        filename: smallRecord,
      },
      {
        name: "a tagged table whose tag is a bare name is read as a plain title",
        code: 'each`a`("scalar", () => {\n  expect(subject).toMatchSnapshot();\n});',
        filename: smallRecord,
      },
      {
        name: "a block whose first argument is spread declares no title of its own",
        code: 'describe(...rest, () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
      },
      {
        name: "a block whose last argument is no function declares no title of its own",
        code: 'describe("outer", it("names a behaviour", () => {\n  expect(subject).toMatchSnapshot();\n}));',
        filename: smallRecord,
      },
      {
        name: "a call standing where the title of a block goes keeps its place among the entries",
        code: 'describe("outer", () => {\n  it("names a behaviour", expect(subject).toMatchSnapshot(), () => {});\n});',
        filename: withoutRecordFile,
      },
      {
        name: "a table declaring no case records nothing to measure",
        code: 'describe("outer", () => {\n  it.each([])("scalar %s", (value) => {\n    expect(value).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
      },
    ],
    invalid: [
      {
        name: "property matchers are no hint, and the repair leaves the call for a human to finish",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot({ id: expect.any(String) });\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: null,
      },
      {
        name: "a property matcher beside a hint is reported without a repair as well",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot({ createdAt: expect.any(Date) }, "the hint");\n  });\n});',
        filename: hintedRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: null,
      },
      {
        name: "naming the spec suffix leaves the shared budget where it was",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: namedSuffixSpec,
        options: [{ specFileSuffixes: [".spec.ts"] }],
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a spread hint cannot be measured and is reported as such",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot(...hints);\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "options that spell out no budget leave the shared budget in force",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
        options: [{}],
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a record inside the budget is reported and moved to an inline record",
        documented: true,
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a record at the budget stays on the inline side of the boundary",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: atTheBudget,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "an inline record ahead of it shifts which entry the call is measured against",
        documented: true,
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(first).toMatchInlineSnapshot(`"first"`);\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: shiftedByInline,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(first).toMatchInlineSnapshot(`"first"`);\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a file record ahead of it shifts which entry the call is measured against",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(first).toMatchFileSnapshot("./first.txt");\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: shiftedByFileRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(first).toMatchFileSnapshot("./first.txt");\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a hint puts the call in its own run of entries and the repair drops it",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot("the hint");\n  });\n});',
        filename: hintedRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a thrown error record moves to the inline spelling of the same matcher",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(run).toThrowErrorMatchingSnapshot();\n  });\n});',
        filename: thrownRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(run).toThrowErrorMatchingInlineSnapshot();\n  });\n});',
      },
      {
        name: "a written out table is measured case by case and asks for a split",
        code: 'describe("outer", () => {\n  it.each([1, 2])("scalar %s", (value) => {\n    expect(value).toMatchSnapshot();\n  });\n});',
        filename: tableRecords,
        errors: [{ messageId: "undersizedTableDrivenSnapshot" }],
      },
      {
        name: "a table built at run time cannot be measured and is reported as such",
        code: 'describe("outer", () => {\n  it.each(rows)("scalar %s", (value) => {\n    expect(value).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a title built at run time cannot be measured and is reported as such",
        code: 'describe("outer", () => {\n  it(`names ${behaviour}`, () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a hint built at run time cannot be measured and is reported as such",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot(chosenHint);\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a call inside a loop has no settled position among the entries",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    for (const value of rows) {\n      expect(value).toMatchSnapshot();\n    }\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a call inside a branch has no settled position among the entries",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    if (ready) {\n      expect(subject).toMatchSnapshot();\n    }\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a call inside a nested callback has no settled position among the entries",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    rows.forEach((value) => {\n      expect(value).toMatchSnapshot();\n    });\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a call after one that lost its position loses its own position too",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    for (const value of rows) {\n      expect(value).toMatchSnapshot();\n    }\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
        errors: [
          { messageId: "unresolvableExternalSnapshot" },
          { messageId: "unresolvableExternalSnapshot" },
        ],
      },
      {
        name: "two title splits that read alike keep separate runs of entries",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});\ndescribe("outer names", () => {\n  it("a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: splitTitles,
        errors: [
          { messageId: "undersizedExternalSnapshot" },
          { messageId: "undersizedExternalSnapshot" },
        ],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});\ndescribe("outer names", () => {\n  it("a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a hinted call and a title that reads alike keep separate runs of entries",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot("the hint");\n  });\n  it("names a behaviour the hint", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: hintAgainstPlainTitle,
        errors: [
          { messageId: "undersizedExternalSnapshot" },
          { messageId: "undersizedExternalSnapshot" },
        ],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n  it("names a behaviour the hint", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a table with more cases than the report lists counts the ones it leaves out",
        code: 'describe("outer", () => {\n  it.each([1, 2, 3, 4])("scalar %s", (value) => {\n    expect(value).toMatchSnapshot();\n  });\n});',
        filename: manyCases,
        errors: [{ messageId: "undersizedTableDrivenSnapshot" }],
      },
      {
        name: "lowering the budget is not a way to leave a record outside",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: overTheBudget,
        options: [{ maxLines: 13 }],
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
    ],
  });
});
