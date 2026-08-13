import { describe, expect, test } from "vite-plus/test";

import { repeatedTestCasesIn } from "./test-cases.ts";

const repeatedTitlesIn = (source: string): readonly string[] =>
  repeatedTestCasesIn(source).map((testCase) => testCase.name);

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

  test("both runner spellings are compared wherever they are nested", () => {
    expect(
      repeatedTitlesIn(`describe("suite", () => {
  test("counts one", function () {});
  it("counts one", function () {});
});
`),
    ).toStrictEqual(["counts one", "counts one"]);
  });

  test("a runner reached through a modifier is compared under its root name", () => {
    expect(
      repeatedTitlesIn(`test.each([1])("counts %i", () => {});
test.each([1])("counts %i", () => {});
`),
    ).toStrictEqual(["counts %i", "counts %i"]);
  });

  test("each reported place carries the line its runner starts on", () => {
    expect(
      repeatedTestCasesIn(`
test("counts one", () => {});

test("counts one", () => {});
`).map((testCase) => testCase.line),
    ).toStrictEqual([2, 4]);
  });

  test("a fixture declared through the builder is not a test", () => {
    expect(
      repeatedTitlesIn(`const it = test.extend("cleanRun", () => run());
const test_ = test.extend("cleanRun", () => run());
`),
    ).toStrictEqual([]);
  });

  test("a call that is not a runner is left out", () => {
    expect(
      repeatedTitlesIn(`describe("suite", () => {});
describe("suite", () => {});
`),
    ).toStrictEqual([]);
  });

  test("a runner whose callee is not a name is left out", () => {
    expect(
      repeatedTitlesIn(`runners[0]("counts one", () => {});
runners[0]("counts one", () => {});
`),
    ).toStrictEqual([]);
  });

  test("a runner reached through an immediately invoked function is left out", () => {
    expect(
      repeatedTitlesIn(`(() => test)("counts one", () => {});
(() => test)("counts one", () => {});
`),
    ).toStrictEqual([]);
  });

  test("a runner without a spelled title is left out", () => {
    expect(
      repeatedTitlesIn(`test(title, () => {});
test(title, () => {});
test(1, () => {});
test(1, () => {});
`),
    ).toStrictEqual([]);
  });

  test("a runner without a body is left out", () => {
    expect(
      repeatedTitlesIn(`test("counts one");
test("counts one");
test("counts two", handler);
test("counts two", handler);
`),
    ).toStrictEqual([]);
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
