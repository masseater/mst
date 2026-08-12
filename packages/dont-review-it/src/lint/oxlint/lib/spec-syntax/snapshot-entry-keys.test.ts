import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { entryKeysOf, snapshotMatcherSiteOf } from "./snapshot-entry-keys.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("keysOfACaseTitleThatRepeats", () => {
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
  })
  .extend("keysOfACaseTitleThatSpellsEachRow", () => {
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
  })
  .extend("keysOfTwoRecordingsHandedInAgainstTheirOrder", () => {
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
  })
  .extend("keysOfARecordingStandingAfterAHiddenPosition", () => {
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
  })
  .extend("keysOfARecordingCarryingAHint", () => {
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
  })
  .extend("keysOfARecordingUnderNestedTitles", () => {
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
  })
  .extend("keysOfARecordingUnderATitleSettledWhileRunning", () => {
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
  })
  .extend("keysOfARecordingUnderATitleThisReadingCannotSpell", () => {
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
  })
  .extend("keysOfARecordingCarryingAHintSettledWhileRunning", () => {
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
  })
  .extend("keysOfARecordingStandingUnderNoTitle", () => {
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
  })
  .extend("keysOfARecordingWrittenUnderATitleAndAHint", () => {
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
  })
  .extend("siteOfAMatcherThatRecordsNothing", () => {
    const declared = parseSync("spec.ts", "expect(subject).toStrictEqual(expected);").program
      .body[0] as ESTree.ExpressionStatement;
    return snapshotMatcherSiteOf(declared.expression as ESTree.CallExpression, []);
  })
  .extend("siteOfARecordingMatcherCarriedByAnotherReceiver", () => {
    const declared = parseSync("spec.ts", "recorder.toMatchSnapshot();").program
      .body[0] as ESTree.ExpressionStatement;
    return snapshotMatcherSiteOf(declared.expression as ESTree.CallExpression, []);
  });

describe("spec-syntax/snapshot-entry-keys", () => {
  it("a case title that repeats numbers each recording where the runner numbers it", ({
    keysOfACaseTitleThatRepeats,
  }) => {
    expect(keysOfACaseTitleThatRepeats).toStrictEqual([
      { kind: "spelled", keys: ["reads a row 1", "reads a row 2"] },
    ]);
  });

  it("a case title that spells each row starts the numbering again under each title", ({
    keysOfACaseTitleThatSpellsEachRow,
  }) => {
    expect(keysOfACaseTitleThatSpellsEachRow).toStrictEqual([
      { kind: "spelled", keys: ["reads alpha 1", "reads beta 1"] },
    ]);
  });

  it("recordings are numbered by where they stand in the spec, not by the order handed in", ({
    keysOfTwoRecordingsHandedInAgainstTheirOrder,
  }) => {
    expect(keysOfTwoRecordingsHandedInAgainstTheirOrder).toStrictEqual([
      { kind: "spelled", keys: ["records twice 2"] },
      { kind: "spelled", keys: ["records twice 1"] },
    ]);
  });

  it("a recording whose position is hidden leaves the recordings before it spelled out", ({
    keysOfARecordingStandingAfterAHiddenPosition,
  }) => {
    expect(keysOfARecordingStandingAfterAHiddenPosition).toStrictEqual([
      { kind: "spelled", keys: ["records twice 1"] },
      { kind: "unresolvable" },
    ]);
  });

  it("a hint stands after the enclosing titles in the key it is recorded under", ({
    keysOfARecordingCarryingAHint,
  }) => {
    expect(keysOfARecordingCarryingAHint).toStrictEqual([
      { kind: "spelled", keys: ["reads a row > shape 1"] },
    ]);
  });

  it("nested titles stand in the key from the outermost block inwards", ({
    keysOfARecordingUnderNestedTitles,
  }) => {
    expect(keysOfARecordingUnderNestedTitles).toStrictEqual([
      { kind: "spelled", keys: ["the outer block > the inner block 1"] },
    ]);
  });

  it("a title settled while the spec runs leaves the key unresolvable", ({
    keysOfARecordingUnderATitleSettledWhileRunning,
  }) => {
    expect(keysOfARecordingUnderATitleSettledWhileRunning).toStrictEqual([
      { kind: "unresolvable" },
    ]);
  });

  it("a title this reading cannot spell leaves the key unreadable", ({
    keysOfARecordingUnderATitleThisReadingCannotSpell,
  }) => {
    expect(keysOfARecordingUnderATitleThisReadingCannotSpell).toStrictEqual([
      { kind: "unreadable" },
    ]);
  });

  it("a hint settled while the spec runs leaves the key unresolvable", ({
    keysOfARecordingCarryingAHintSettledWhileRunning,
  }) => {
    expect(keysOfARecordingCarryingAHintSettledWhileRunning).toStrictEqual([
      { kind: "unresolvable" },
    ]);
  });

  it("a recording standing under no title at all leaves the key unreadable", ({
    keysOfARecordingStandingUnderNoTitle,
  }) => {
    expect(keysOfARecordingStandingUnderNoTitle).toStrictEqual([{ kind: "unreadable" }]);
  });

  it("a recording read from the spec it stands in carries its titles and its hint", ({
    keysOfARecordingWrittenUnderATitleAndAHint,
  }) => {
    expect(keysOfARecordingWrittenUnderATitleAndAHint).toStrictEqual([
      { kind: "spelled", keys: ["the outer block > the inner block > shape 1"] },
    ]);
  });

  it("a matcher that records nothing stands at no recording site", ({
    siteOfAMatcherThatRecordsNothing,
  }) => {
    expect(siteOfAMatcherThatRecordsNothing).toBe(null);
  });

  it("a recording matcher carried by another receiver stands at no recording site", ({
    siteOfARecordingMatcherCarriedByAnotherReceiver,
  }) => {
    expect(siteOfARecordingMatcherCarriedByAnotherReceiver).toBe(null);
  });
});
