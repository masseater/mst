import { describe, expect, test } from "vite-plus/test";

import { repeatedTestCasesIn, testCasesIn } from "./test-cases.ts";

const titlesIn = (source: string): readonly string[] =>
  testCasesIn(source).map((testCase) => testCase.name);

const repeatedTitlesIn = (source: string): readonly string[] =>
  repeatedTestCasesIn(source).map((testCase) => testCase.name);

describe("testCasesIn", () => {
  test("both runner spellings are collected wherever they are nested", () => {
    expect(
      titlesIn(`describe("suite", () => {
  test("counts one", () => {});
  it("counts two", function () {});
});
`),
    ).toStrictEqual(["counts one", "counts two"]);
  });

  test("a runner reached through a modifier is collected under its root name", () => {
    expect(titlesIn(`test.each([1])("counts %i", () => {});\n`)).toStrictEqual(["counts %i"]);
  });

  test("a fixture declared through the builder is not a test", () => {
    expect(titlesIn(`const it = test.extend("cleanRun", () => run());\n`)).toStrictEqual([]);
  });

  test("a call that is not a runner is left out", () => {
    expect(titlesIn(`describe("suite", () => {});\nexpect(total).toBe(1);\n`)).toStrictEqual([]);
  });

  test("a runner whose callee is not a name is left out", () => {
    expect(titlesIn(`runners[0]("counts one", () => {});\n`)).toStrictEqual([]);
  });

  test("a runner without a spelled title is left out", () => {
    expect(titlesIn(`test(title, () => {});\ntest(1, () => {});\n`)).toStrictEqual([]);
  });

  test("a runner without a body is left out", () => {
    expect(titlesIn(`test("counts one");\ntest("counts two", handler);\n`)).toStrictEqual([]);
  });

  test("a runner records the line it starts on", () => {
    expect(testCasesIn(`\n\ntest("counts one", () => {});\n`)[0]?.line).toBe(3);
  });

  test("the node count of a body grows with what the body carries", () => {
    const [empty, filled] = testCasesIn(`test("counts nothing", () => {});
test("counts one", () => {
  expect(total).toBe(1);
});
`);

    expect(Number(filled?.nodeCount)).toBeGreaterThan(Number(empty?.nodeCount));
  });
});

describe("repeatedTestCasesIn", () => {
  test("a title and body spelled twice yields both places", () => {
    expect(
      repeatedTitlesIn(`test("counts one", () => {
  expect(total).toBe(1);
});
it("counts one", () => {
  expect(total).toBe(1);
});
`),
    ).toStrictEqual(["counts one", "counts one"]);
  });

  test("a shared body under different titles is not a repeat", () => {
    expect(
      repeatedTitlesIn(`test("counts one", () => {
  expect(total).toBe(1);
});
test("counts the same total", () => {
  expect(total).toBe(1);
});
`),
    ).toStrictEqual([]);
  });

  test("a shared title over different bodies is not a repeat", () => {
    expect(
      repeatedTitlesIn(`test("counts one", () => {
  expect(total).toBe(1);
});
test("counts one", () => {
  expect(other).toBe(1);
});
`),
    ).toStrictEqual([]);
  });
});
