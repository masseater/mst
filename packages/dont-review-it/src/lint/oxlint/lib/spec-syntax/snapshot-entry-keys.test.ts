import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { nodeVisitsOfType } from "../nodes-of-type.ts";
import { entryKeysOf, snapshotMatcherSiteOf } from "./snapshot-entry-keys.ts";

import type { ESTree } from "@oxlint/plugins";

describe("entryKeysOf", () => {
  describe("a snapshot inside nested titles", () => {
    const it = test.extend("keysOfASnapshotInsideNestedTitles", () => {
      const statement = parseSync(
        "spec.ts",
        'describe("outer", () => {\n  test("inner", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("is keyed by the titles of the blocks it sits in and its ordinal", ({
      keysOfASnapshotInsideNestedTitles,
    }) => {
      expect(keysOfASnapshotInsideNestedTitles).toStrictEqual([["outer > inner 1"]]);
    });
  });

  describe("a second snapshot under the same titles", () => {
    const it = test.extend("keysOfASecondSnapshotUnderTheSameTitles", () => {
      const statement = parseSync(
        "spec.ts",
        'test("case", () => {\n  expect(first).toMatchSnapshot();\n  expect(second).toMatchSnapshot();\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("takes the next ordinal", ({ keysOfASecondSnapshotUnderTheSameTitles }) => {
      expect(keysOfASecondSnapshotUnderTheSameTitles).toStrictEqual([["case 1"], ["case 2"]]);
    });
  });

  describe("a snapshot hint", () => {
    const it = test.extend("keysOfASnapshotHint", () => {
      const statement = parseSync(
        "spec.ts",
        'test("case", () => {\n  expect(subject).toMatchSnapshot("shape");\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("is keyed after the titles it is written under", ({ keysOfASnapshotHint }) => {
      expect(keysOfASnapshotHint).toStrictEqual([["case > shape 1"]]);
    });
  });

  describe("a lone object argument", () => {
    const it = test.extend("keysOfALoneObjectArgument", () => {
      const statement = parseSync(
        "spec.ts",
        'test("case", () => {\n  expect(subject).toMatchSnapshot({ id: expect.any(Number) });\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("holds property matchers rather than a hint", ({ keysOfALoneObjectArgument }) => {
      expect(keysOfALoneObjectArgument).toStrictEqual([["case 1"]]);
    });
  });

  describe("a hint that is not written out", () => {
    const it = test.extend("keysOfAHintThatIsNotWrittenOut", () => {
      const statement = parseSync(
        "spec.ts",
        'test("case", () => {\n  expect(subject).toMatchSnapshot(label);\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("leaves the key unresolvable", ({ keysOfAHintThatIsNotWrittenOut }) => {
      expect(keysOfAHintThatIsNotWrittenOut).toStrictEqual(["unresolvable"]);
    });
  });

  describe("an argument list handed over as a spread", () => {
    const it = test.extend("keysOfAnArgumentListHandedOverAsASpread", () => {
      const statement = parseSync(
        "spec.ts",
        'test("case", () => {\n  expect(subject).toMatchSnapshot(...hints);\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("leaves the key unresolvable", ({ keysOfAnArgumentListHandedOverAsASpread }) => {
      expect(keysOfAnArgumentListHandedOverAsASpread).toStrictEqual(["unresolvable"]);
    });
  });

  describe("a matcher that records into a file of its own", () => {
    const it = test.extend("keysOfAMatcherRecordingIntoAFileOfItsOwn", () => {
      const statement = parseSync(
        "spec.ts",
        'test("case", () => {\n  expect(subject).toMatchFileSnapshot("./recorded.txt");\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("carries no hint", ({ keysOfAMatcherRecordingIntoAFileOfItsOwn }) => {
      expect(keysOfAMatcherRecordingIntoAFileOfItsOwn).toStrictEqual([["case 1"]]);
    });
  });

  describe("a table-driven block", () => {
    const it = test.extend("keysOfATableDrivenBlock", () => {
      const statement = parseSync(
        "spec.ts",
        'test.each([1, 2])("case %s", () => {\n  expect(subject).toMatchSnapshot();\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("keys one recorded value per case", ({ keysOfATableDrivenBlock }) => {
      expect(keysOfATableDrivenBlock).toStrictEqual([["case 1 1", "case 2 1"]]);
    });
  });

  describe("cases that spell one title", () => {
    const it = test.extend("keysOfCasesThatSpellOneTitle", () => {
      const statement = parseSync(
        "spec.ts",
        'test.each([1, 1])("case %s", () => {\n  expect(subject).toMatchSnapshot();\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("share it and take an ordinal each", ({ keysOfCasesThatSpellOneTitle }) => {
      expect(keysOfCasesThatSpellOneTitle).toStrictEqual([["case 1 1", "case 1 2"]]);
    });
  });

  describe("a table that is not written out", () => {
    const it = test.extend("keysOfATableThatIsNotWrittenOut", () => {
      const statement = parseSync(
        "spec.ts",
        'test.each(rows)("case %s", () => {\n  expect(subject).toMatchSnapshot();\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("leaves the key unresolvable", ({ keysOfATableThatIsNotWrittenOut }) => {
      expect(keysOfATableThatIsNotWrittenOut).toStrictEqual(["unresolvable"]);
    });
  });

  describe("a table handed over as a spread", () => {
    const it = test.extend("keysOfATableHandedOverAsASpread", () => {
      const statement = parseSync(
        "spec.ts",
        'test.each(...groups)("case %s", () => {\n  expect(subject).toMatchSnapshot();\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("leaves the block spelling only its own title", ({ keysOfATableHandedOverAsASpread }) => {
      expect(keysOfATableHandedOverAsASpread).toStrictEqual([["case %s 1"]]);
    });
  });

  describe("a table written as a tagged template", () => {
    const it = test.extend("keysOfATableWrittenAsATaggedTemplate", () => {
      const statement = parseSync(
        "spec.ts",
        'describe.each`case`("title $a", () => {\n  expect(subject).toMatchSnapshot();\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("leaves the key unreadable", ({ keysOfATableWrittenAsATaggedTemplate }) => {
      expect(keysOfATableWrittenAsATaggedTemplate).toStrictEqual(["unreadable"]);
    });
  });

  describe("a tagged template that names no table member", () => {
    const it = test.extend("keysOfATaggedTemplateNamingNoTableMember", () => {
      const statement = parseSync(
        "spec.ts",
        'rows`a | b`("case", () => {\n  expect(subject).toMatchSnapshot();\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("spells the title as written", ({ keysOfATaggedTemplateNamingNoTableMember }) => {
      expect(keysOfATaggedTemplateNamingNoTableMember).toStrictEqual([["case 1"]]);
    });
  });

  describe("a block builder that takes fixtures rather than a table", () => {
    const it = test.extend("keysOfABlockBuilderTakingFixtures", () => {
      const statement = parseSync(
        "spec.ts",
        'test.extend({ store })("case", () => {\n  expect(subject).toMatchSnapshot();\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("spells its own title", ({ keysOfABlockBuilderTakingFixtures }) => {
      expect(keysOfABlockBuilderTakingFixtures).toStrictEqual([["case 1"]]);
    });
  });

  describe("a block built by a plain call", () => {
    const it = test.extend("keysOfABlockBuiltByAPlainCall", () => {
      const statement = parseSync(
        "spec.ts",
        'suiteFor(loader)("case", () => {\n  expect(subject).toMatchSnapshot();\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("spells its own title", ({ keysOfABlockBuiltByAPlainCall }) => {
      expect(keysOfABlockBuiltByAPlainCall).toStrictEqual([["case 1"]]);
    });
  });

  describe("a call whose last argument is not a block body", () => {
    const it = test.extend("keysOfACallWhoseLastArgumentIsNotABlockBody", () => {
      const statement = parseSync(
        "spec.ts",
        'test("case", () => {\n  collect(expect(subject).toMatchSnapshot(), tail);\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("opens no title", ({ keysOfACallWhoseLastArgumentIsNotABlockBody }) => {
      expect(keysOfACallWhoseLastArgumentIsNotABlockBody).toStrictEqual([["case 1"]]);
    });
  });

  describe("a call handed a spread argument", () => {
    const it = test.extend("keysOfACallHandedASpreadArgument", () => {
      const statement = parseSync(
        "spec.ts",
        'test("case", () => {\n  collect(...parts, expect(subject).toMatchSnapshot());\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("opens no title", ({ keysOfACallHandedASpreadArgument }) => {
      expect(keysOfACallHandedASpreadArgument).toStrictEqual([["case 1"]]);
    });
  });

  describe("a snapshot taken in a hook", () => {
    const it = test.extend("keysOfASnapshotTakenInAHook", () => {
      const statement = parseSync(
        "spec.ts",
        'describe("case", () => {\n  beforeEach(() => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("cannot be placed among the recorded values", ({ keysOfASnapshotTakenInAHook }) => {
      expect(keysOfASnapshotTakenInAHook).toStrictEqual(["unresolvable"]);
    });
  });

  describe("a snapshot behind a branch", () => {
    const it = test.extend("keysOfASnapshotBehindABranch", () => {
      const statement = parseSync(
        "spec.ts",
        'test("case", () => {\n  expect(first).toMatchSnapshot();\n  if (flag) {\n    expect(second).toMatchSnapshot();\n  }\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("loses its key while the one before it keeps its own", ({
      keysOfASnapshotBehindABranch,
    }) => {
      expect(keysOfASnapshotBehindABranch).toStrictEqual([["case 1"], "unresolvable"]);
    });
  });

  describe("a snapshot written where the block title belongs", () => {
    const it = test.extend("keysOfASnapshotWhereTheBlockTitleBelongs", () => {
      const statement = parseSync(
        "spec.ts",
        "test(expect(subject).toMatchSnapshot(), () => {\n  run();\n});",
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("leaves the key unresolvable", ({ keysOfASnapshotWhereTheBlockTitleBelongs }) => {
      expect(keysOfASnapshotWhereTheBlockTitleBelongs).toStrictEqual(["unresolvable"]);
    });
  });

  describe("a snapshot outside every titled block", () => {
    const it = test.extend("keysOfASnapshotOutsideEveryTitledBlock", () => {
      const statement = parseSync("spec.ts", "expect(subject).toMatchSnapshot();").program
        .body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("leaves the key unreadable", ({ keysOfASnapshotOutsideEveryTitledBlock }) => {
      expect(keysOfASnapshotOutsideEveryTitledBlock).toStrictEqual(["unreadable"]);
    });
  });

  describe("a snapshot matcher called on something other than an assertion", () => {
    const it = test.extend("keysOfAMatcherCalledOnSomethingOtherThanAnAssertion", () => {
      const statement = parseSync(
        "spec.ts",
        'test("case", () => {\n  recorder.toMatchSnapshot();\n});',
      ).program.body[0] as ESTree.Statement;
      return entryKeysOf(
        nodeVisitsOfType(statement, "CallExpression").flatMap(
          (visit) => snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [],
        ),
      ).map((snapshotEntryKeys) =>
        snapshotEntryKeys.kind === "spelled" ? snapshotEntryKeys.keys : snapshotEntryKeys.kind,
      );
    });

    it("is no site", ({ keysOfAMatcherCalledOnSomethingOtherThanAnAssertion }) => {
      expect(keysOfAMatcherCalledOnSomethingOtherThanAnAssertion).toStrictEqual([]);
    });
  });

  describe("a case title that repeats", () => {
    const it = test.extend("keysOfACaseTitleThatRepeats", () => {
      const declared = parseSync("spec.ts", "expect(subject).toMatchSnapshot();").program
        .body[0] as ESTree.ExpressionStatement;
      const recorded = declared.expression as ESTree.CallExpression;
      return entryKeysOf([
        {
          node: recorded,
          matcher: "toMatchSnapshot",
          matcherNode: recorded.callee,
          hintNode: null,
          hintText: null,
          hintRuntime: false,
          scopes: [{ kind: "spelled", titles: ["reads a row", "reads a row"] }],
          orderBroken: false,
        },
      ]);
    });

    it("numbers each recording where the runner numbers it", ({ keysOfACaseTitleThatRepeats }) => {
      expect(keysOfACaseTitleThatRepeats).toStrictEqual([
        { kind: "spelled", keys: ["reads a row 1", "reads a row 2"] },
      ]);
    });
  });

  describe("a case title that spells each row", () => {
    const it = test.extend("keysOfACaseTitleThatSpellsEachRow", () => {
      const declared = parseSync("spec.ts", "expect(subject).toMatchSnapshot();").program
        .body[0] as ESTree.ExpressionStatement;
      const recorded = declared.expression as ESTree.CallExpression;
      return entryKeysOf([
        {
          node: recorded,
          matcher: "toMatchSnapshot",
          matcherNode: recorded.callee,
          hintNode: null,
          hintText: null,
          hintRuntime: false,
          scopes: [{ kind: "spelled", titles: ["reads alpha", "reads beta"] }],
          orderBroken: false,
        },
      ]);
    });

    it("starts the numbering again under each title", ({ keysOfACaseTitleThatSpellsEachRow }) => {
      expect(keysOfACaseTitleThatSpellsEachRow).toStrictEqual([
        { kind: "spelled", keys: ["reads alpha 1", "reads beta 1"] },
      ]);
    });
  });

  describe("two recordings handed in against their order", () => {
    const it = test.extend("keysOfTwoRecordingsHandedInAgainstTheirOrder", () => {
      const written = parseSync(
        "spec.ts",
        "expect(first).toMatchSnapshot();\nexpect(second).toMatchSnapshot();",
      ).program;
      const earlier = (written.body[0] as ESTree.ExpressionStatement)
        .expression as ESTree.CallExpression;
      const later = (written.body[1] as ESTree.ExpressionStatement)
        .expression as ESTree.CallExpression;
      return entryKeysOf([
        {
          node: later,
          matcher: "toMatchSnapshot",
          matcherNode: later.callee,
          hintNode: null,
          hintText: null,
          hintRuntime: false,
          scopes: [{ kind: "spelled", titles: ["records twice"] }],
          orderBroken: false,
        },
        {
          node: earlier,
          matcher: "toMatchSnapshot",
          matcherNode: earlier.callee,
          hintNode: null,
          hintText: null,
          hintRuntime: false,
          scopes: [{ kind: "spelled", titles: ["records twice"] }],
          orderBroken: false,
        },
      ]);
    });

    it("are numbered by where they stand in the spec, not by the order handed in", ({
      keysOfTwoRecordingsHandedInAgainstTheirOrder,
    }) => {
      expect(keysOfTwoRecordingsHandedInAgainstTheirOrder).toStrictEqual([
        { kind: "spelled", keys: ["records twice 2"] },
        { kind: "spelled", keys: ["records twice 1"] },
      ]);
    });
  });

  describe("a recording whose position is hidden", () => {
    const it = test.extend("keysOfARecordingStandingAfterAHiddenPosition", () => {
      const written = parseSync(
        "spec.ts",
        "expect(first).toMatchSnapshot();\nexpect(second).toMatchSnapshot();",
      ).program;
      const earlier = (written.body[0] as ESTree.ExpressionStatement)
        .expression as ESTree.CallExpression;
      const later = (written.body[1] as ESTree.ExpressionStatement)
        .expression as ESTree.CallExpression;
      return entryKeysOf([
        {
          node: earlier,
          matcher: "toMatchSnapshot",
          matcherNode: earlier.callee,
          hintNode: null,
          hintText: null,
          hintRuntime: false,
          scopes: [{ kind: "spelled", titles: ["records twice"] }],
          orderBroken: false,
        },
        {
          node: later,
          matcher: "toMatchSnapshot",
          matcherNode: later.callee,
          hintNode: null,
          hintText: null,
          hintRuntime: false,
          scopes: [{ kind: "spelled", titles: ["records twice"] }],
          orderBroken: true,
        },
      ]);
    });

    it("leaves the recordings before it spelled out", ({
      keysOfARecordingStandingAfterAHiddenPosition,
    }) => {
      expect(keysOfARecordingStandingAfterAHiddenPosition).toStrictEqual([
        { kind: "spelled", keys: ["records twice 1"] },
        { kind: "unresolvable" },
      ]);
    });
  });

  describe("a recording carrying a hint", () => {
    const it = test.extend("keysOfARecordingCarryingAHint", () => {
      const declared = parseSync("spec.ts", 'expect(subject).toMatchSnapshot("shape");').program
        .body[0] as ESTree.ExpressionStatement;
      const recorded = declared.expression as ESTree.CallExpression;
      return entryKeysOf([
        {
          node: recorded,
          matcher: "toMatchSnapshot",
          matcherNode: recorded.callee,
          hintNode: null,
          hintText: "shape",
          hintRuntime: false,
          scopes: [{ kind: "spelled", titles: ["reads a row"] }],
          orderBroken: false,
        },
      ]);
    });

    it("stands after the enclosing titles in the key it is recorded under", ({
      keysOfARecordingCarryingAHint,
    }) => {
      expect(keysOfARecordingCarryingAHint).toStrictEqual([
        { kind: "spelled", keys: ["reads a row > shape 1"] },
      ]);
    });
  });

  describe("nested titles", () => {
    const it = test.extend("keysOfARecordingUnderNestedTitles", () => {
      const declared = parseSync("spec.ts", "expect(subject).toMatchSnapshot();").program
        .body[0] as ESTree.ExpressionStatement;
      const recorded = declared.expression as ESTree.CallExpression;
      return entryKeysOf([
        {
          node: recorded,
          matcher: "toMatchSnapshot",
          matcherNode: recorded.callee,
          hintNode: null,
          hintText: null,
          hintRuntime: false,
          scopes: [
            { kind: "spelled", titles: ["the outer block"] },
            { kind: "spelled", titles: ["the inner block"] },
          ],
          orderBroken: false,
        },
      ]);
    });

    it("stand in the key from the outermost block inwards", ({
      keysOfARecordingUnderNestedTitles,
    }) => {
      expect(keysOfARecordingUnderNestedTitles).toStrictEqual([
        { kind: "spelled", keys: ["the outer block > the inner block 1"] },
      ]);
    });
  });

  describe("a title settled while the spec runs", () => {
    const it = test.extend("keysOfARecordingUnderATitleSettledWhileRunning", () => {
      const declared = parseSync("spec.ts", "expect(subject).toMatchSnapshot();").program
        .body[0] as ESTree.ExpressionStatement;
      const recorded = declared.expression as ESTree.CallExpression;
      return entryKeysOf([
        {
          node: recorded,
          matcher: "toMatchSnapshot",
          matcherNode: recorded.callee,
          hintNode: null,
          hintText: null,
          hintRuntime: false,
          scopes: [{ kind: "spelled", titles: ["reads a row"] }, { kind: "runtime" }],
          orderBroken: false,
        },
      ]);
    });

    it("leaves the key unresolvable", ({ keysOfARecordingUnderATitleSettledWhileRunning }) => {
      expect(keysOfARecordingUnderATitleSettledWhileRunning).toStrictEqual([
        { kind: "unresolvable" },
      ]);
    });
  });

  describe("a title this reading cannot spell", () => {
    const it = test.extend("keysOfARecordingUnderATitleThisReadingCannotSpell", () => {
      const declared = parseSync("spec.ts", "expect(subject).toMatchSnapshot();").program
        .body[0] as ESTree.ExpressionStatement;
      const recorded = declared.expression as ESTree.CallExpression;
      return entryKeysOf([
        {
          node: recorded,
          matcher: "toMatchSnapshot",
          matcherNode: recorded.callee,
          hintNode: null,
          hintText: null,
          hintRuntime: false,
          scopes: [{ kind: "unreadable" }],
          orderBroken: false,
        },
      ]);
    });

    it("leaves the key unreadable", ({ keysOfARecordingUnderATitleThisReadingCannotSpell }) => {
      expect(keysOfARecordingUnderATitleThisReadingCannotSpell).toStrictEqual([
        { kind: "unreadable" },
      ]);
    });
  });

  describe("a hint settled while the spec runs", () => {
    const it = test.extend("keysOfARecordingCarryingAHintSettledWhileRunning", () => {
      const declared = parseSync("spec.ts", "expect(subject).toMatchSnapshot(hint);").program
        .body[0] as ESTree.ExpressionStatement;
      const recorded = declared.expression as ESTree.CallExpression;
      return entryKeysOf([
        {
          node: recorded,
          matcher: "toMatchSnapshot",
          matcherNode: recorded.callee,
          hintNode: null,
          hintText: null,
          hintRuntime: true,
          scopes: [{ kind: "spelled", titles: ["reads a row"] }],
          orderBroken: false,
        },
      ]);
    });

    it("leaves the key unresolvable", ({ keysOfARecordingCarryingAHintSettledWhileRunning }) => {
      expect(keysOfARecordingCarryingAHintSettledWhileRunning).toStrictEqual([
        { kind: "unresolvable" },
      ]);
    });
  });

  describe("a recording standing under no title at all", () => {
    const it = test.extend("keysOfARecordingStandingUnderNoTitle", () => {
      const declared = parseSync("spec.ts", "expect(subject).toMatchSnapshot();").program
        .body[0] as ESTree.ExpressionStatement;
      const recorded = declared.expression as ESTree.CallExpression;
      return entryKeysOf([
        {
          node: recorded,
          matcher: "toMatchSnapshot",
          matcherNode: recorded.callee,
          hintNode: null,
          hintText: null,
          hintRuntime: false,
          scopes: [],
          orderBroken: false,
        },
      ]);
    });

    it("leaves the key unreadable", ({ keysOfARecordingStandingUnderNoTitle }) => {
      expect(keysOfARecordingStandingUnderNoTitle).toStrictEqual([{ kind: "unreadable" }]);
    });
  });

  describe("a recording read from the spec it stands in", () => {
    const it = test.extend("keysOfARecordingWrittenUnderATitleAndAHint", () => {
      const declared = parseSync(
        "spec.ts",
        'describe("the outer block", () => { it("the inner block", () => { expect(subject).toMatchSnapshot("shape"); }); });',
      ).program.body[0] as ESTree.ExpressionStatement;
      const outer = declared.expression as ESTree.CallExpression;
      const outerBody = (outer.arguments[1] as ESTree.ArrowFunctionExpression)
        .body as ESTree.BlockStatement;
      const inner = (outerBody.body[0] as ESTree.ExpressionStatement)
        .expression as ESTree.CallExpression;
      const innerBody = (inner.arguments[1] as ESTree.ArrowFunctionExpression)
        .body as ESTree.BlockStatement;
      const held = innerBody.body[0] as ESTree.ExpressionStatement;
      const site = snapshotMatcherSiteOf(held.expression as ESTree.CallExpression, [
        outer,
        inner,
        innerBody,
        held,
      ]);
      return entryKeysOf(site === null ? [] : [site]);
    });

    it("carries its titles and its hint", ({ keysOfARecordingWrittenUnderATitleAndAHint }) => {
      expect(keysOfARecordingWrittenUnderATitleAndAHint).toStrictEqual([
        { kind: "spelled", keys: ["the outer block > the inner block > shape 1"] },
      ]);
    });
  });
});

describe("snapshotMatcherSiteOf", () => {
  describe("a matcher that records nothing", () => {
    const it = test.extend("siteOfAMatcherThatRecordsNothing", () => {
      const declared = parseSync("spec.ts", "expect(subject).toStrictEqual(expected);").program
        .body[0] as ESTree.ExpressionStatement;
      return snapshotMatcherSiteOf(declared.expression as ESTree.CallExpression, []);
    });

    it("stands at no recording site", ({ siteOfAMatcherThatRecordsNothing }) => {
      expect(siteOfAMatcherThatRecordsNothing).toBe(null);
    });
  });

  describe("a recording matcher carried by another receiver", () => {
    const it = test.extend("siteOfARecordingMatcherCarriedByAnotherReceiver", () => {
      const declared = parseSync("spec.ts", "recorder.toMatchSnapshot();").program
        .body[0] as ESTree.ExpressionStatement;
      return snapshotMatcherSiteOf(declared.expression as ESTree.CallExpression, []);
    });

    it("stands at no recording site", ({ siteOfARecordingMatcherCarriedByAnotherReceiver }) => {
      expect(siteOfARecordingMatcherCarriedByAnotherReceiver).toBe(null);
    });
  });
});
