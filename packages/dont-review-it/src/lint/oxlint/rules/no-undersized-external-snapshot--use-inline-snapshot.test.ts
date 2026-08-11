import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { range } from "es-toolkit";
import { describe } from "vite-plus/test";

import { noUndersizedExternalSnapshot } from "./no-undersized-external-snapshot--use-inline-snapshot.ts";

const fixtureDir = join(tmpdir(), "dont-review-it-no-undersized-external-snapshot");
rmSync(fixtureDir, { recursive: true, force: true });

const SPEC_FILE_NAME = "subject.test.ts";

const recordOf = (lines: number): string =>
  lines === 1
    ? '"alpha"'
    : `\n${range(lines)
        .map((at) => `line ${String(at)}`)
        .join("\n")}\n`;

const specPathOf = (directory: string, specFileName: string = SPEC_FILE_NAME): string =>
  join(fixtureDir, directory, specFileName);

const writeSpecFixture = (specPath: string, records: Readonly<Record<string, string>>): string => {
  mkdirSync(join(dirname(specPath), "__snapshots__"), { recursive: true });
  const written = Object.entries(records)
    .map(([key, record]) => `exports[\`${key}\`] = \`${record}\`;\n`)
    .join("\n");
  writeFileSync(
    join(dirname(specPath), "__snapshots__", `${basename(specPath)}.snap`),
    `// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html\n\n${written}`,
  );
  return specPath;
};

const plainSpec = (body: string): string =>
  `describe("outer", () => {\n  it("names a behaviour", () => {\n${body}\n  });\n});`;

const smallRecord = writeSpecFixture(specPathOf("small-record"), {
  "outer > names a behaviour 1": recordOf(3),
});

const atTheBudget = writeSpecFixture(specPathOf("at-the-budget"), {
  "outer > names a behaviour 1": recordOf(12),
});

const overTheBudget = writeSpecFixture(specPathOf("over-the-budget"), {
  "outer > names a behaviour 1": recordOf(13),
});

const shiftedByInline = writeSpecFixture(specPathOf("shifted-by-inline"), {
  "outer > names a behaviour 1": recordOf(13),
  "outer > names a behaviour 2": recordOf(1),
});

const shiftedByFileRecord = writeSpecFixture(specPathOf("shifted-by-file-record"), {
  "outer > names a behaviour 1": recordOf(13),
  "outer > names a behaviour 2": recordOf(1),
});

const hintedRecord = writeSpecFixture(specPathOf("hinted-record"), {
  "outer > names a behaviour 1": recordOf(13),
  "outer > names a behaviour > the hint 1": recordOf(1),
});

const thrownRecord = writeSpecFixture(specPathOf("thrown-record"), {
  "outer > names a behaviour 1": recordOf(1),
});

const tableRecords = writeSpecFixture(specPathOf("table-records"), {
  "outer > scalar 1 1": recordOf(1),
  "outer > scalar 2 1": recordOf(1),
});

const partialTableRecords = writeSpecFixture(specPathOf("partial-table-records"), {
  "outer > scalar 1 1": recordOf(1),
});

const unrecordedKey = writeSpecFixture(specPathOf("unrecorded-key"), {
  "outer > some other behaviour 1": recordOf(1),
});

const splitTitles = writeSpecFixture(specPathOf("split-titles"), {
  "outer > names a behaviour 1": recordOf(1),
  "outer names > a behaviour 1": recordOf(1),
});

const hintAgainstPlainTitle = writeSpecFixture(specPathOf("hint-against-plain-title"), {
  "outer > names a behaviour > the hint 1": recordOf(1),
  "outer > names a behaviour the hint 1": recordOf(1),
});

const manyCases = writeSpecFixture(specPathOf("many-cases"), {
  "outer > scalar 1 1": recordOf(1),
  "outer > scalar 2 1": recordOf(1),
  "outer > scalar 3 1": recordOf(1),
  "outer > scalar 4 1": recordOf(1),
});

const namedSuffixSpec = writeSpecFixture(specPathOf("named-suffix", "subject.spec.ts"), {
  "outer > names a behaviour 1": recordOf(3),
});

const withoutRecordFile = specPathOf("no-record-file");
mkdirSync(dirname(withoutRecordFile), { recursive: true });

describe("dont-review-it/no-undersized-external-snapshot--use-inline-snapshot", () => {
  testLintRule(noUndersizedExternalSnapshot, {
    valid: [
      {
        name: "a file that is not a spec is left alone",
        code: plainSpec("expect(subject).toMatchSnapshot();"),
        filename: join(fixtureDir, "small-record", "subject.ts"),
      },
      {
        name: "a spec with no record file has nothing to measure",
        code: plainSpec("expect(subject).toMatchSnapshot();"),
        filename: withoutRecordFile,
      },
      {
        name: "a key the record file does not carry has nothing to measure",
        code: plainSpec("expect(subject).toMatchSnapshot();"),
        filename: unrecordedKey,
      },
      {
        name: "a record past the budget is already in the right place",
        code: plainSpec("expect(subject).toMatchSnapshot();"),
        filename: overTheBudget,
      },
      {
        name: "an inline record is the other rule's subject",
        code: plainSpec('expect(subject).toMatchInlineSnapshot(`"alpha"`);'),
        filename: smallRecord,
      },
      {
        name: "a file record is the counter's business and not this rule's",
        code: plainSpec('expect(subject).toMatchFileSnapshot("./subject.txt");'),
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
        code: plainSpec("expect(subject).toMatchSnapshot();"),
        filename: smallRecord,
        options: [{ maxLines: 2 }],
      },
      {
        name: "a table declared over no cases records nothing to measure",
        code: 'describe("outer", () => {\n  it.each([])("scalar %s", (value) => {\n    expect(value).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
      },
    ],
    invalid: [
      {
        name: "a record inside the budget is reported and moved to an inline record",
        code: plainSpec("    expect(subject).toMatchSnapshot();"),
        filename: smallRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: plainSpec("    expect(subject).toMatchInlineSnapshot();"),
      },
      {
        name: "a record at the budget stays on the inline side of the boundary",
        code: plainSpec("    expect(subject).toMatchSnapshot();"),
        filename: atTheBudget,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: plainSpec("    expect(subject).toMatchInlineSnapshot();"),
      },
      {
        name: "an inline record ahead of it shifts which entry the call is measured against",
        code: plainSpec(
          '    expect(first).toMatchInlineSnapshot(`"first"`);\n    expect(subject).toMatchSnapshot();',
        ),
        filename: shiftedByInline,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: plainSpec(
          '    expect(first).toMatchInlineSnapshot(`"first"`);\n    expect(subject).toMatchInlineSnapshot();',
        ),
      },
      {
        name: "a file record ahead of it shifts which entry the call is measured against",
        code: plainSpec(
          '    expect(first).toMatchFileSnapshot("./first.txt");\n    expect(subject).toMatchSnapshot();',
        ),
        filename: shiftedByFileRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: plainSpec(
          '    expect(first).toMatchFileSnapshot("./first.txt");\n    expect(subject).toMatchInlineSnapshot();',
        ),
      },
      {
        name: "a hint puts the call in its own run of entries and the repair drops it",
        code: plainSpec('    expect(subject).toMatchSnapshot("the hint");'),
        filename: hintedRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: plainSpec("    expect(subject).toMatchInlineSnapshot();"),
      },
      {
        name: "a thrown error record moves to the inline spelling of the same matcher",
        code: plainSpec("    expect(run).toThrowErrorMatchingSnapshot();"),
        filename: thrownRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: plainSpec("    expect(run).toThrowErrorMatchingInlineSnapshot();"),
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
        code: plainSpec("    expect(subject).toMatchSnapshot(chosenHint);"),
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a call inside a loop has no settled position among the entries",
        code: plainSpec(
          "    for (const value of rows) {\n      expect(value).toMatchSnapshot();\n    }",
        ),
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a call inside a branch has no settled position among the entries",
        code: plainSpec("    if (ready) {\n      expect(subject).toMatchSnapshot();\n    }"),
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a call inside a nested callback has no settled position among the entries",
        code: plainSpec(
          "    rows.forEach((value) => {\n      expect(value).toMatchSnapshot();\n    });",
        ),
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a call after one that lost its position loses its own position too",
        code: plainSpec(
          "    for (const value of rows) {\n      expect(value).toMatchSnapshot();\n    }\n    expect(subject).toMatchSnapshot();",
        ),
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
        code: plainSpec("    expect(subject).toMatchSnapshot();"),
        filename: overTheBudget,
        options: [{ maxLines: 13 }],
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: plainSpec("    expect(subject).toMatchInlineSnapshot();"),
      },
      {
        name: "naming the spec suffix leaves the shared budget where it was",
        code: plainSpec("    expect(subject).toMatchSnapshot();"),
        filename: namedSuffixSpec,
        options: [{ specFileSuffixes: [".spec.ts"] }],
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: plainSpec("    expect(subject).toMatchInlineSnapshot();"),
      },
      {
        name: "a property matcher is reported without a repair because the matcher has to be carried by hand",
        code: plainSpec("    expect(subject).toMatchSnapshot({ createdAt: expect.any(Date) });"),
        filename: smallRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: null,
      },
      {
        name: "a property matcher beside a hint is reported without a repair as well",
        code: plainSpec(
          '    expect(subject).toMatchSnapshot({ createdAt: expect.any(Date) }, "the hint");',
        ),
        filename: hintedRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: null,
      },
    ],
  });
});
