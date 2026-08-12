import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noNormalizeSutOutput } from "./no-normalize-sut-output--assert-natural-shape.ts";

const SPEC_FILE = "report.test.ts";

const importingDir = mkdtempSync(join(tmpdir(), "dont-review-it-no-normalize-sut-output-"));
writeFileSync(join(importingDir, "shape.ts"), "export const ordered = (rows) => rows.sort();\n");
writeFileSync(join(importingDir, "widen.ts"), "export const widen = (rows) => rows.map(toRow);\n");
writeFileSync(join(importingDir, "held.ts"), "export const held = summarise(input).sort();\n");

const IMPORTING_SPEC_FILE = join(importingDir, "report.test.ts");

const reshapedBehind = (spelled: string) => [
  { messageId: "normalizedBehindName", data: { spelled, operation: "sort" } },
];

const rewrittenBy = (operation: string) => [
  { messageId: "mutatedSubject", data: { operation, subject: "produced" } },
];

describe("dont-review-it/no-normalize-sut-output--assert-natural-shape", () => {
  testLintRule(noNormalizeSutOutput, {
    valid: [
      {
        name: "a fixture that hands back the call under test hands back what the code produced",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => summarise(input));',
      },
      {
        name: "a binding holding the call under test is still what the code produced",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => {\n  const produced = summarise(input);\n  return produced;\n});',
      },
      {
        name: "the handoff form hands back what the code produced too",
        filename: SPEC_FILE,
        code: "const test = baseTest.extend({\n  rows: async ({ input }, use) => {\n    await use(summarise(input));\n  },\n});",
      },
      {
        name: "a transform that does not reshape the produced value is not in this vocabulary",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => summarise(input).map(toRow));',
      },
      {
        name: "a helper that hands the produced value straight back reaches no operation",
        filename: SPEC_FILE,
        code: 'const widen = (rows) => rows.map(toRow);\nconst test = baseTest.extend("rows", () => widen(summarise(input)));',
      },
      {
        name: "an ordering written inside the it body is read by the rule that owns the it body",
        filename: SPEC_FILE,
        code: 'test("lists the rows", ({ rows }) => {\n  const ordered = rows.sort();\n  expect(ordered).toStrictEqual([]);\n});',
      },
      {
        name: "an ordering written inside expect is read by the rule that owns the assertion",
        filename: SPEC_FILE,
        code: 'test("lists the rows", ({ rows }) => {\n  expect(rows.sort()).toStrictEqual([]);\n});',
      },
      {
        name: "a callee named at run time cannot be read as an operation",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => summarise(input)[step]());',
      },
      {
        name: "an operation inside a callback handed to the code under test is not on the way out",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => summarise(() => input.sort()));',
      },
      {
        name: "a collection the spec builds itself is read by the rule that owns construction",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => [{ id: "a" }, { id: "b" }]);',
      },
      {
        name: "a value handed to the fixture without a factory reaches no operation",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", { id: "a" });',
      },
      {
        name: "a write to a binding the fixture never hands back leaves the subject untouched",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => {\n  const scratch = [];\n  scratch.push(1);\n  return summarise(input);\n});',
      },
      {
        name: "a write that runs after the handoff cannot reach the value the assertion reads",
        filename: SPEC_FILE,
        code: "const test = baseTest.extend({\n  rows: async ({ input }, use) => {\n    const produced = summarise(input);\n    await use(produced);\n    produced.sort();\n  },\n});",
      },
      {
        name: "a function name dropped from the vocabulary is no longer read as an operation",
        filename: SPEC_FILE,
        options: [{ normalizingFunctions: [] }],
        code: 'const test = baseTest.extend("rows", () => sortBy(summarise(input), ["id"]));',
      },
      {
        name: "registering a custom matcher declares no fixture to read",
        filename: SPEC_FILE,
        code: "expect.extend({ toBeRow });",
      },
      {
        name: "a name that leads to no readable declaration reaches no return path",
        filename: SPEC_FILE,
        code: 'const widen = registry.widen;\nconst test = baseTest.extend("rows", () => widen(buildShaper()(summarise(input))));',
      },
      {
        name: "a name the fixture receives is that value, not the one the file binds elsewhere",
        filename: SPEC_FILE,
        code: "const rows = untidy.sort();\nconst test = baseTest.extend({\n  rows: ({ rows }, use) => {\n    use(rows);\n  },\n});",
      },
      {
        name: "a dependency taken apart further binds no name this reading can hold on to",
        filename: SPEC_FILE,
        code: "const test = baseTest.extend({\n  rows: ({ report: { rows } }, use) => {\n    use(rows);\n  },\n});",
      },
      {
        name: "a name the fixture receives is that value, not the one the file imports",
        filename: IMPORTING_SPEC_FILE,
        code: 'import { ordered } from "./shape.ts";\nconst test = baseTest.extend({\n  ordered: ({ ordered }, use) => {\n    use(ordered);\n  },\n});',
      },
      {
        name: "a name a followed declaration receives is that value, not the one the file binds",
        filename: SPEC_FILE,
        code: 'const handed = untidy.sort();\nconst widen = (handed) => handed;\nconst test = baseTest.extend("rows", () => widen(summarise(input)));',
      },
      {
        name: "a pair of names bound to each other is followed until it repeats",
        filename: SPEC_FILE,
        code: 'const outward = inward;\nconst inward = outward;\nconst test = baseTest.extend("rows", () => outward);',
      },
      {
        name: "a write to something the fixture never named is nothing this reading tracks",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => {\n  carried = 1;\n  void reset();\n  delete carried;\n  delete summarise(input).id;\n  summarise(input).id = "a";\n  summarise(input).rows.sort();\n  return summarise(input);\n});',
      },
      {
        name: "a module the import names but the disk does not hold reaches no return path",
        filename: IMPORTING_SPEC_FILE,
        code: 'import { ordered } from "./absent.ts";\nconst test = baseTest.extend("rows", () => ordered(summarise(input)));',
      },
      {
        name: "copying properties onto something else is not a write to the produced value",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => {\n  const produced = summarise(input);\n  Object.assign();\n  Object.assign(summarise(input), { id: "a" });\n  Object.freeze(produced);\n  registry.assign(produced, { id: "a" });\n  helpers.util.assign(produced, { id: "a" });\n  return produced;\n});',
      },
      {
        name: "a module reached through a dependency is judged by the spelling of its names",
        filename: IMPORTING_SPEC_FILE,
        code: 'import { widen } from "./widen.ts";\nconst test = baseTest.extend("rows", () => widen(summarise(input)));',
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "report.ts",
        code: 'const test = baseTest.extend("rows", () => summarise(input).sort());',
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: ["-test.ts"] }],
        code: 'const test = baseTest.extend("rows", () => summarise(input).sort());',
      },
    ],
    invalid: [
      {
        name: "ordering the produced collection reshapes it on the way out",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => summarise(input).sort());',
        errors: [{ messageId: "normalizedSubject", data: { operation: "sort" } }],
      },
      {
        name: "ordering into a new collection reshapes it just as much",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => summarise(input).toSorted());',
        errors: [{ messageId: "normalizedSubject", data: { operation: "toSorted" } }],
      },
      {
        name: "reversing the produced collection reshapes it on the way out",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => summarise(input).toReversed());',
        errors: [{ messageId: "normalizedSubject", data: { operation: "toReversed" } }],
      },
      {
        name: "folding the produced collection rebuilds it on the way out",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => summarise(input).reduce(intoTotals, {}));',
        errors: [{ messageId: "normalizedSubject", data: { operation: "reduce" } }],
      },
      {
        name: "unifying the formatting of the produced text reshapes it on the way out",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("line", () => render(input).trim());',
        errors: [{ messageId: "normalizedSubject", data: { operation: "trim" } }],
      },
      {
        name: "substituting inside the produced text reshapes it on the way out",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("line", () => render(input).replaceAll("\\r\\n", "\\n"));',
        errors: [{ messageId: "normalizedSubject", data: { operation: "replaceAll" } }],
      },
      {
        name: "an ordering function named in the vocabulary reshapes it the same way",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => sortBy(summarise(input), ["id"]));',
        errors: [{ messageId: "normalizedSubject", data: { operation: "sortBy" } }],
      },
      {
        name: "dropping duplicates from the produced collection reshapes it too",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => uniqBy(summarise(input), toId));',
        errors: [{ messageId: "normalizedSubject", data: { operation: "uniqBy" } }],
      },
      {
        name: "an operation buried under a later transform is still on the way out",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => summarise(input).sort().map(toRow));',
        errors: [{ messageId: "normalizedSubject", data: { operation: "sort" } }],
      },
      {
        name: "an operation nested in a call argument is still on the way out",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => widen(summarise(input).sort()));',
        errors: [{ messageId: "normalizedSubject", data: { operation: "sort" } }],
      },
      {
        name: "an operation parked in a binding is reached by following the binding",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => {\n  const ordered = summarise(input).sort();\n  return ordered;\n});',
        errors: [{ messageId: "normalizedSubject", data: { operation: "sort" } }],
      },
      {
        name: "a member name spelled in brackets reads as the same operation",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => summarise(input)["sort"]());',
        errors: [{ messageId: "normalizedSubject", data: { operation: "sort" } }],
      },
      {
        name: "a member name spelled as a template reads as the same operation",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => summarise(input)[`sort`]());',
        errors: [{ messageId: "normalizedSubject", data: { operation: "sort" } }],
      },
      {
        name: "the handoff form reshapes the produced value the same way",
        filename: SPEC_FILE,
        code: "const test = baseTest.extend({\n  rows: async ({ input }, use) => {\n    await use(summarise(input).sort());\n  },\n});",
        errors: [{ messageId: "normalizedSubject", data: { operation: "sort" } }],
      },
      {
        name: "an operation pushed behind a name in this file is reached through the name",
        filename: SPEC_FILE,
        code: 'const ordered = (rows) => rows.sort();\nconst test = baseTest.extend("rows", () => ordered(summarise(input)));',
        errors: reshapedBehind("ordered"),
      },
      {
        name: "an operation pushed two names deep is reached through the first name",
        filename: SPEC_FILE,
        code: 'const ordered = (rows) => rows.sort();\nconst prepared = (rows) => ordered(rows);\nconst test = baseTest.extend("rows", () => prepared(summarise(input)));',
        errors: reshapedBehind("prepared"),
      },
      {
        name: "an operation behind a function declaration is reached the same way",
        filename: SPEC_FILE,
        code: 'function ordered(rows) {\n  return rows.sort();\n}\nconst test = baseTest.extend("rows", () => ordered(summarise(input)));',
        errors: reshapedBehind("ordered"),
      },
      {
        name: "an operation behind a function declared in the fixture is reached the same way",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => {\n  function tidy(handed) {\n    return handed.sort();\n  }\n  return tidy(summarise(input));\n});',
        errors: reshapedBehind("tidy"),
      },
      {
        name: "copying properties over the produced value reshapes it on the way out",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => Object.assign(summarise(input), extra));',
        errors: [{ messageId: "normalizedSubject", data: { operation: "Object.assign" } }],
      },
      {
        name: "an operation behind a function expression is reached the same way",
        filename: SPEC_FILE,
        code: 'const ordered = function (rows) {\n  return rows.sort();\n};\nconst test = baseTest.extend("rows", () => ordered(summarise(input)));',
        errors: reshapedBehind("ordered"),
      },
      {
        name: "an operation pushed into another module is reached by reading that module",
        filename: IMPORTING_SPEC_FILE,
        code: 'import { ordered } from "./shape.ts";\nconst test = baseTest.extend("rows", () => ordered(summarise(input)));',
        errors: reshapedBehind("ordered"),
      },
      {
        name: "a value another module already reshaped is reached through the name it arrives under",
        filename: IMPORTING_SPEC_FILE,
        code: 'import { held } from "./held.ts";\nconst test = baseTest.extend("rows", () => held);',
        errors: [{ messageId: "normalizedBehindName", data: { name: "held", operation: "sort" } }],
      },
      {
        name: "ordering the binding in place rewrites the value before it is handed back",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => {\n  const produced = summarise(input);\n  produced.sort();\n  return produced;\n});',
        errors: rewrittenBy("`sort`"),
      },
      {
        name: "adding an element rewrites the value before it is handed back",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => {\n  const produced = summarise(input);\n  produced.push(extra);\n  return produced;\n});',
        errors: rewrittenBy("`push`"),
      },
      {
        name: "writing a property rewrites the value before it is handed back",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => {\n  const produced = summarise(input);\n  produced.id = "a";\n  return produced;\n});',
        errors: rewrittenBy("An assignment"),
      },
      {
        name: "removing a property rewrites the value before it is handed back",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => {\n  const produced = summarise(input);\n  delete produced.id;\n  return produced;\n});',
        errors: rewrittenBy("A `delete`"),
      },
      {
        name: "copying properties over the binding rewrites the value before it is handed back",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => {\n  const produced = summarise(input);\n  Object.assign(produced, { id: "a" });\n  return produced;\n});',
        errors: rewrittenBy("`Object.assign`"),
      },
      {
        name: "a rewrite under a branch still runs before the value is handed back",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => {\n  const produced = summarise(input);\n  if (produced.length > 0) {\n    produced.sort();\n  }\n  return produced;\n});',
        errors: rewrittenBy("`sort`"),
      },
      {
        name: "a rewrite reached through a second binding is still a rewrite of the same value",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => {\n  const produced = summarise(input);\n  const handed = produced;\n  produced.sort();\n  return handed;\n});',
        errors: rewrittenBy("`sort`"),
      },
      {
        name: "the handoff form reads a rewrite that runs before the handoff",
        filename: SPEC_FILE,
        code: "const test = baseTest.extend({\n  rows: async ({ input }, use) => {\n    const produced = summarise(input);\n    produced.sort();\n    await use(produced);\n  },\n});",
        errors: rewrittenBy("`sort`"),
      },
    ],
  });
});
