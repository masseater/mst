import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { isAstFields, NODE_TYPE_FIELD } from "../ast-node.ts";
import { entryKeysOf, snapshotMatcherSiteOf } from "./snapshot-entry-keys.ts";

import type { ESTree } from "@oxlint/plugins";

const SPEC_FILE = "spec.ts";

type Visit = {
  readonly node: ESTree.Node;
  readonly ancestors: readonly ESTree.Node[];
};

const fieldsOf = (held: unknown): readonly unknown[] | null => {
  if (!isAstFields(held)) return null;
  return typeof held[NODE_TYPE_FIELD] === "string" ? Object.values(held) : null;
};

const visitsUnder = (held: unknown, ancestors: readonly ESTree.Node[]): readonly Visit[] => {
  if (Array.isArray(held)) {
    const listed: readonly unknown[] = held;
    return listed.flatMap((entry) => visitsUnder(entry, ancestors));
  }

  const fields = fieldsOf(held);
  if (fields === null) return [];

  const node = held as ESTree.Node;
  const nested = [...ancestors, node];
  return [{ node, ancestors }, ...fields.flatMap((field) => visitsUnder(field, nested))];
};

const keysIn = (sourceText: string): readonly (readonly string[] | string)[] => {
  const sites = visitsUnder(parseSync(SPEC_FILE, sourceText).program, []).flatMap((visit) =>
    visit.node.type === "CallExpression"
      ? (snapshotMatcherSiteOf(visit.node, visit.ancestors) ?? [])
      : [],
  );
  return entryKeysOf(sites).map((entry) => (entry.kind === "spelled" ? entry.keys : entry.kind));
};

describe("dont-review-it/spec-syntax/snapshot-entry-keys", () => {
  test("a snapshot is keyed by the titles of the blocks it sits in and its ordinal", () => {
    expect(
      keysIn(`describe("outer", () => {
  test("inner", () => {
    expect(subject).toMatchSnapshot();
  });
});`),
    ).toStrictEqual([["outer > inner 1"]]);
  });

  test("a second snapshot under the same titles takes the next ordinal", () => {
    expect(
      keysIn(`test("case", () => {
  expect(first).toMatchSnapshot();
  expect(second).toMatchSnapshot();
});`),
    ).toStrictEqual([["case 1"], ["case 2"]]);
  });

  test("a snapshot hint is keyed after the titles it is written under", () => {
    expect(
      keysIn(`test("case", () => {
  expect(subject).toMatchSnapshot("shape");
});`),
    ).toStrictEqual([["case > shape 1"]]);
  });

  test("a lone object argument holds property matchers rather than a hint", () => {
    expect(
      keysIn(`test("case", () => {
  expect(subject).toMatchSnapshot({ id: expect.any(Number) });
});`),
    ).toStrictEqual([["case 1"]]);
  });

  test("a hint that is not written out leaves the key unresolvable", () => {
    expect(
      keysIn(`test("case", () => {
  expect(subject).toMatchSnapshot(label);
});`),
    ).toStrictEqual(["unresolvable"]);
  });

  test("an argument list handed over as a spread leaves the key unresolvable", () => {
    expect(
      keysIn(`test("case", () => {
  expect(subject).toMatchSnapshot(...hints);
});`),
    ).toStrictEqual(["unresolvable"]);
  });

  test("a matcher that records into a file of its own carries no hint", () => {
    expect(
      keysIn(`test("case", () => {
  expect(subject).toMatchFileSnapshot("./recorded.txt");
});`),
    ).toStrictEqual([["case 1"]]);
  });

  test("a table-driven block keys one recorded value per case", () => {
    expect(
      keysIn(`test.each([1, 2])("case %s", () => {
  expect(subject).toMatchSnapshot();
});`),
    ).toStrictEqual([["case 1 1", "case 2 1"]]);
  });

  test("cases that spell one title share it and take an ordinal each", () => {
    expect(
      keysIn(`test.each([1, 1])("case %s", () => {
  expect(subject).toMatchSnapshot();
});`),
    ).toStrictEqual([["case 1 1", "case 1 2"]]);
  });

  test("a table that is not written out leaves the key unresolvable", () => {
    expect(
      keysIn(`test.each(rows)("case %s", () => {
  expect(subject).toMatchSnapshot();
});`),
    ).toStrictEqual(["unresolvable"]);
  });

  test("a table handed over as a spread leaves the block spelling only its own title", () => {
    expect(
      keysIn(`test.each(...groups)("case %s", () => {
  expect(subject).toMatchSnapshot();
});`),
    ).toStrictEqual([["case %s 1"]]);
  });

  test("a table written as a tagged template leaves the key unreadable", () => {
    expect(
      keysIn(`describe.each\`case\`("title $a", () => {
  expect(subject).toMatchSnapshot();
});`),
    ).toStrictEqual(["unreadable"]);
  });

  test("a tagged template that names no table member spells the title as written", () => {
    expect(
      keysIn(`rows\`a | b\`("case", () => {
  expect(subject).toMatchSnapshot();
});`),
    ).toStrictEqual([["case 1"]]);
  });

  test("a block builder that takes fixtures rather than a table spells its own title", () => {
    expect(
      keysIn(`test.extend({ store })("case", () => {
  expect(subject).toMatchSnapshot();
});`),
    ).toStrictEqual([["case 1"]]);
  });

  test("a block built by a plain call spells its own title", () => {
    expect(
      keysIn(`suiteFor(loader)("case", () => {
  expect(subject).toMatchSnapshot();
});`),
    ).toStrictEqual([["case 1"]]);
  });

  test("a call whose last argument is not a block body opens no title", () => {
    expect(
      keysIn(`test("case", () => {
  collect(expect(subject).toMatchSnapshot(), tail);
});`),
    ).toStrictEqual([["case 1"]]);
  });

  test("a call handed a spread argument opens no title", () => {
    expect(
      keysIn(`test("case", () => {
  collect(...parts, expect(subject).toMatchSnapshot());
});`),
    ).toStrictEqual([["case 1"]]);
  });

  test("a snapshot taken in a hook cannot be placed among the recorded values", () => {
    expect(
      keysIn(`describe("case", () => {
  beforeEach(() => {
    expect(subject).toMatchSnapshot();
  });
});`),
    ).toStrictEqual(["unresolvable"]);
  });

  test("a snapshot behind a branch loses its key while the one before it keeps its own", () => {
    expect(
      keysIn(`test("case", () => {
  expect(first).toMatchSnapshot();
  if (flag) {
    expect(second).toMatchSnapshot();
  }
});`),
    ).toStrictEqual([["case 1"], "unresolvable"]);
  });

  test("a snapshot written where the block title belongs leaves the key unresolvable", () => {
    expect(
      keysIn(`test(expect(subject).toMatchSnapshot(), () => {
  run();
});`),
    ).toStrictEqual(["unresolvable"]);
  });

  test("a snapshot outside every titled block leaves the key unreadable", () => {
    expect(keysIn("expect(subject).toMatchSnapshot();")).toStrictEqual(["unreadable"]);
  });

  test("a snapshot matcher called on something other than an assertion is no site", () => {
    expect(
      keysIn(`test("case", () => {
  recorder.toMatchSnapshot();
});`),
    ).toStrictEqual([]);
  });
});
