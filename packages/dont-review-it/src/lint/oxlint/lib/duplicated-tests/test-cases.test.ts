import { describe, expect, test } from "vite-plus/test";

import { repeatedTestCasesIn } from "./test-cases.ts";

describe("repeatedTestCasesIn", () => {
  describe("a title and body spelled twice under the two runner spellings", () => {
    const it = test.extend("repeatedTitles", () =>
      repeatedTestCasesIn(`test("counts one", () => {
  expect(total).toBe(1);
});
it("counts one", () => {
  expect(total).toBe(1);
});
`).map((repeatedTestCase) => repeatedTestCase.name));

    it("yields both places the title was spelled", ({ repeatedTitles }) => {
      expect(repeatedTitles).toStrictEqual(["counts one", "counts one"]);
    });
  });

  describe("the two runner spellings nested inside a grouping block", () => {
    const it = test.extend("repeatedTitles", () =>
      repeatedTestCasesIn(`describe("suite", () => {
  test("counts one", function () {});
  it("counts one", function () {});
});
`).map((repeatedTestCase) => repeatedTestCase.name));

    it("compares them wherever they are nested", ({ repeatedTitles }) => {
      expect(repeatedTitles).toStrictEqual(["counts one", "counts one"]);
    });
  });

  describe("a runner reached through a modifier", () => {
    const it = test.extend("repeatedTitles", () =>
      repeatedTestCasesIn(`test.each([1])("counts %i", () => {});
test.each([1])("counts %i", () => {});
`).map((repeatedTestCase) => repeatedTestCase.name));

    it("compares it under its root name", ({ repeatedTitles }) => {
      expect(repeatedTitles).toStrictEqual(["counts %i", "counts %i"]);
    });
  });

  describe("a repeated title spelled on two separated lines", () => {
    const it = test.extend("repeatedLines", () =>
      repeatedTestCasesIn(`
test("counts one", () => {});

test("counts one", () => {});
`).map((repeatedTestCase) => repeatedTestCase.line));

    it("carries the line each runner starts on", ({ repeatedLines }) => {
      expect(repeatedLines).toStrictEqual([2, 4]);
    });
  });

  describe("a fixture declared twice through the builder", () => {
    const it = test.extend("repeatedTestCases", () =>
      repeatedTestCasesIn(`const it = test.extend("cleanRun", () => run());
const test_ = test.extend("cleanRun", () => run());
`));

    it("reads neither declaration as a test", ({ repeatedTestCases }) => {
      expect(repeatedTestCases).toStrictEqual([]);
    });
  });

  describe("a repeated call that is not a runner", () => {
    const it = test.extend("repeatedTestCases", () =>
      repeatedTestCasesIn(`describe("suite", () => {});
describe("suite", () => {});
`));

    it("leaves that call out", ({ repeatedTestCases }) => {
      expect(repeatedTestCases).toStrictEqual([]);
    });
  });

  describe("a repeated runner whose callee is not a name", () => {
    const it = test.extend("repeatedTestCases", () =>
      repeatedTestCasesIn(`runners[0]("counts one", () => {});
runners[0]("counts one", () => {});
`));

    it("leaves that runner out", ({ repeatedTestCases }) => {
      expect(repeatedTestCases).toStrictEqual([]);
    });
  });

  describe("a repeated runner reached through an immediately invoked function", () => {
    const it = test.extend("repeatedTestCases", () =>
      repeatedTestCasesIn(`(() => test)("counts one", () => {});
(() => test)("counts one", () => {});
`));

    it("leaves that runner out", ({ repeatedTestCases }) => {
      expect(repeatedTestCases).toStrictEqual([]);
    });
  });

  describe("repeated runners without a spelled title", () => {
    const it = test.extend("repeatedTestCases", () =>
      repeatedTestCasesIn(`test(title, () => {});
test(title, () => {});
test(1, () => {});
test(1, () => {});
`));

    it("leaves every untitled runner out", ({ repeatedTestCases }) => {
      expect(repeatedTestCases).toStrictEqual([]);
    });
  });

  describe("repeated runners without a body", () => {
    const it = test.extend("repeatedTestCases", () =>
      repeatedTestCasesIn(`test("counts one");
test("counts one");
test("counts two", handler);
test("counts two", handler);
`));

    it("leaves every bodyless runner out", ({ repeatedTestCases }) => {
      expect(repeatedTestCases).toStrictEqual([]);
    });
  });

  describe("a shared body under different titles", () => {
    const it = test.extend("repeatedTestCases", () =>
      repeatedTestCasesIn(`test("counts one", () => {
  expect(total).toBe(1);
});
test("counts the same total", () => {
  expect(total).toBe(1);
});
`));

    it("reads that pair as no repeat", ({ repeatedTestCases }) => {
      expect(repeatedTestCases).toStrictEqual([]);
    });
  });

  describe("a shared title over different bodies", () => {
    const it = test.extend("repeatedTestCases", () =>
      repeatedTestCasesIn(`test("counts one", () => {
  expect(total).toBe(1);
});
test("counts one", () => {
  expect(other).toBe(1);
});
`));

    it("reads that pair as no repeat", ({ repeatedTestCases }) => {
      expect(repeatedTestCases).toStrictEqual([]);
    });
  });

  describe("a shared title and body under two named situations", () => {
    const it = test.extend("repeatedTestCases", () =>
      repeatedTestCasesIn(`describe("a tally that was never added to", () => {
  test("counts one", () => {
    expect(total).toBe(1);
  });
});
describe("a tally added to once", () => {
  test("counts one", () => {
    expect(total).toBe(1);
  });
});
`));

    it("reads them as separate claims", ({ repeatedTestCases }) => {
      expect(repeatedTestCases).toStrictEqual([]);
    });
  });

  describe("a shared title and body under one named situation", () => {
    const it = test.extend("repeatedTestCaseTitles", () =>
      repeatedTestCasesIn(`describe("a tally that was never added to", () => {
  test("counts one", () => {
    expect(total).toBe(1);
  });
  test("counts one", () => {
    expect(total).toBe(1);
  });
});
`).map((repeated) => repeated.name));

    it("reads them as a repeat", ({ repeatedTestCaseTitles }) => {
      expect(repeatedTestCaseTitles).toStrictEqual(["counts one", "counts one"]);
    });
  });

  describe("a shared title and body under situations nobody spelled out", () => {
    const it = test.extend("repeatedTestCaseTitles", () =>
      repeatedTestCasesIn(`describe(namedElsewhere, () => {
  test("counts one", () => {
    expect(total).toBe(1);
  });
});
describe(namedElsewhere, () => {
  test("counts one", () => {
    expect(total).toBe(1);
  });
});
`).map((repeated) => repeated.name));

    it("reads them as a repeat", ({ repeatedTestCaseTitles }) => {
      expect(repeatedTestCaseTitles).toStrictEqual(["counts one", "counts one"]);
    });
  });
});
