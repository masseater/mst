import { describe, expect, test } from "vite-plus/test";

import { extractClaims } from "./claims.ts";

const extract = (source: string): ReturnType<typeof extractClaims> =>
  extractClaims({ file: "packages/repository-checks/specs/text-joining.spec.ts", source });

const messagesOf = (source: string): readonly string[] =>
  extract(source).problems.map((problem) => problem.message);

describe("extractClaims", () => {
  test("reads the subject from a top-level describe and the claims from its its", () => {
    const read = extract(`describe("行の結合", () => {
  it("各要素を改行で終わる 1 つの文字列に畳む", () => {});
  it("空の一覧を空文字列に畳む", () => {});
});
`);
    expect(read.subjects).toStrictEqual([
      {
        subject: "行の結合",
        claims: ["各要素を改行で終わる 1 つの文字列に畳む", "空の一覧を空文字列に畳む"],
      },
    ]);
  });

  test("reads every describe of a file with several subjects", () => {
    const read = extract(`describe("one", () => {
  it("first", () => {});
});
describe("two", () => {
  it("second", () => {});
});
`);
    expect(read.subjects.map((subject) => subject.subject)).toStrictEqual(["one", "two"]);
  });

  test("reads a claim through parentheses around names and callbacks", () => {
    const read = extract(`describe(("wrapped"), (() => {
  it(("claim"), () => {});
}));
`);
    expect(read.subjects).toStrictEqual([{ subject: "wrapped", claims: ["claim"] }]);
  });

  test("reads a claim from an arrow callback without braces", () => {
    const read = extract(`describe("terse", () => it("claim", () => {}));
`);
    expect(read.subjects).toStrictEqual([{ subject: "terse", claims: ["claim"] }]);
  });

  test("ignores statements that are not runner calls", () => {
    const read = extract(`import { it, describe } from "vite-plus/test";
const shared = 1;
describe("subject", () => {
  const local = shared;
  (() => {})();
  void local;
  it("claim", () => { expect(local).toBe(1); });
});
`);
    expect(read.subjects).toStrictEqual([{ subject: "subject", claims: ["claim"] }]);
  });

  test("reports an it that was given no name at all", () => {
    expect(messagesOf("describe('s', () => { it() });\n")).toStrictEqual([
      expect.stringContaining("must not carry a computed name"),
    ]);
  });

  test("reports a describe whose callback is not a function", () => {
    expect(messagesOf("describe('s', 5);\n")).toStrictEqual([
      expect.stringContaining("must not stand without claims"),
    ]);
  });

  test("reports a file holding only a call that is no runner at all", () => {
    expect(messagesOf("(() => {})();\n")).toStrictEqual([
      expect.stringContaining("must not go without a top-level describe"),
    ]);
  });

  test("reports a file the parser rejects", () => {
    expect(messagesOf("describe(\n")).toStrictEqual([
      expect.stringContaining("must parse as TypeScript"),
    ]);
  });

  test("reports a describe whose name is computed", () => {
    expect(messagesOf("describe(`t${'x'}`, () => { it('a', () => {}) });\n")).toStrictEqual([
      expect.stringContaining("must not carry a computed name"),
    ]);
  });

  test("reports an it whose name is computed", () => {
    expect(messagesOf("describe('s', () => { it(`c${'x'}`, () => {}) });\n")).toStrictEqual([
      expect.stringContaining("must not carry a computed name"),
    ]);
  });

  test("reports a claim declared with the test function", () => {
    expect(messagesOf("describe('s', () => { test('c', () => {}) });\n")).toStrictEqual([
      expect.stringContaining("Replace test with it"),
    ]);
  });

  test("reports a describe narrowed through a member", () => {
    expect(messagesOf("describe.skip('s', () => { it('c', () => {}) });\n")).toStrictEqual([
      expect.stringContaining("must not be narrowed through a member"),
    ]);
  });

  test("reports an it narrowed through each", () => {
    expect(messagesOf("describe('s', () => { it.each([1])('c %i', () => {}) });\n")).toStrictEqual([
      expect.stringContaining("must not be narrowed through a member"),
    ]);
  });

  test("reports a describe with no claims", () => {
    expect(messagesOf("describe('s', () => {});\n")).toStrictEqual([
      expect.stringContaining("must not stand without claims"),
    ]);
  });

  test("does not stack an empty-subject report on a claim that already reported", () => {
    expect(messagesOf("describe('s', () => { it(`c${'x'}`, () => {}) });\n")).toHaveLength(1);
  });

  test("reports a file with no describe", () => {
    expect(messagesOf("const nothing = 1;\n")).toStrictEqual([
      expect.stringContaining("must not go without a top-level describe"),
    ]);
  });

  test("keeps no subject for a describe whose every claim failed to read", () => {
    const read = extract("describe('s', () => { it(`c${'x'}`, () => {}) });\n");
    expect(read.subjects).toStrictEqual([]);
  });

  test("names the line a problem sits on", () => {
    const read = extract("describe('s', () => {\n  test('c', () => {});\n});\n");
    expect(read.problems.map((problem) => problem.line)).toStrictEqual([2]);
  });

  test("names the file it was given in every problem", () => {
    expect(extract("const nothing = 1;\n").problems.map((problem) => problem.file)).toStrictEqual([
      "packages/repository-checks/specs/text-joining.spec.ts",
    ]);
  });

  test("reports a claim whose name is a number", () => {
    expect(messagesOf("describe('s', () => { it(5, () => {}) });\n")).toStrictEqual([
      expect.stringContaining("must not carry a computed name"),
    ]);
  });

  test("leaves a nested describe to the lint rule that owns nesting", () => {
    const read = extract(`describe("outer", () => {
  it("kept", () => {});
  describe("inner", () => {
    it("dropped", () => {});
  });
});
`);
    expect(read.subjects).toStrictEqual([{ subject: "outer", claims: ["kept"] }]);
    expect(read.problems).toStrictEqual([]);
  });

  test("keeps the subjects of one describe while another reports a problem", () => {
    const read = extract(`describe("sound", () => {
  it("kept", () => {});
});
describe("broken", () => {
  test("rejected", () => {});
});
`);
    expect(read.subjects).toStrictEqual([{ subject: "sound", claims: ["kept"] }]);
    expect(read.problems.map((problem) => problem.message)).toStrictEqual([
      expect.stringContaining("Replace test with it"),
    ]);
  });

  test("ignores a describe whose callback is missing", () => {
    expect(messagesOf("describe('s');\n")).toStrictEqual([
      expect.stringContaining("must not stand without claims"),
    ]);
  });

  test("ignores a call whose callee is not a runner", () => {
    expect(messagesOf("setup('s', () => {});\n")).toStrictEqual([
      expect.stringContaining("must not go without a top-level describe"),
    ]);
  });
});
