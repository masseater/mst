import { describe, expect, test } from "vite-plus/test";

import { extractClaims } from "./claims.ts";

const SPEC_FILE = "packages/repository-checks/specs/text-joining.spec.ts";

const UNPARSABLE_SOURCE =
  "A specification test must parse as TypeScript, because its claims are read without running it. Fix the syntax so the parser accepts the file.";

const COMPUTED_NAME =
  "A subject or claim must not carry a computed name, because the specification list is assembled without running the tests. Write the first argument as a plain string literal.";

const TEST_FUNCTION_CLAIM =
  "A claim must not be declared with the test function, because a claim reads as a sentence about the subject and it keeps that form. Replace test with it.";

const NARROWED_RUNNER =
  "A describe or it must not be narrowed through a member such as each, skip or only, because a claim that runs conditionally or in variants cannot be read as one plain sentence. Write each claim as its own it with a literal name.";

const SUBJECT_WITHOUT_CLAIMS =
  "A subject must not stand without claims, because a heading with no sentences under it promises nothing. Give the describe at least one it, or delete it.";

const FILE_WITHOUT_SUBJECTS =
  "A specification test file must not go without a top-level describe, because the generated list groups claims under subjects. Declare a describe whose name is the feature the file specifies.";

describe("extractClaims", () => {
  describe("a top-level describe holding two its", () => {
    const it = test.extend("extractionOfATopLevelDescribe", () =>
      extractClaims({
        file: SPEC_FILE,
        source: `describe("行の結合", () => {
  it("各要素を改行で終わる 1 つの文字列に畳む", () => {});
  it("空の一覧を空文字列に畳む", () => {});
});
`,
      }));

    it("reads the subject from the describe and a claim from each of its its", ({
      extractionOfATopLevelDescribe,
    }) => {
      expect(extractionOfATopLevelDescribe).toStrictEqual({
        subjects: [
          {
            subject: "行の結合",
            claims: ["各要素を改行で終わる 1 つの文字列に畳む", "空の一覧を空文字列に畳む"],
          },
        ],
        problems: [],
      });
    });
  });

  describe("a file carrying several describes", () => {
    const it = test.extend("extractionOfAFileWithSeveralDescribes", () =>
      extractClaims({
        file: SPEC_FILE,
        source: `describe("one", () => {
  it("first", () => {});
});
describe("two", () => {
  it("second", () => {});
});
`,
      }));

    it("reads every describe of the file as its own subject", ({
      extractionOfAFileWithSeveralDescribes,
    }) => {
      expect(extractionOfAFileWithSeveralDescribes).toStrictEqual({
        subjects: [
          { subject: "one", claims: ["first"] },
          { subject: "two", claims: ["second"] },
        ],
        problems: [],
      });
    });
  });

  describe("parentheses wrapped around the names and the callbacks", () => {
    const it = test.extend("extractionOfSubjectsReadThroughParentheses", () =>
      extractClaims({
        file: SPEC_FILE,
        source: `describe(("wrapped"), (() => {
  it(("claim"), () => {});
}));
`,
      }));

    it("reads the subject and the claim through them", ({
      extractionOfSubjectsReadThroughParentheses,
    }) => {
      expect(extractionOfSubjectsReadThroughParentheses).toStrictEqual({
        subjects: [{ subject: "wrapped", claims: ["claim"] }],
        problems: [],
      });
    });
  });

  describe("a describe whose arrow callback carries no braces", () => {
    const it = test.extend("extractionOfATerseArrowCallback", () =>
      extractClaims({
        file: SPEC_FILE,
        source: `describe("terse", () => it("claim", () => {}));
`,
      }));

    it("reads the claim out of the returned expression", ({ extractionOfATerseArrowCallback }) => {
      expect(extractionOfATerseArrowCallback).toStrictEqual({
        subjects: [{ subject: "terse", claims: ["claim"] }],
        problems: [],
      });
    });
  });

  describe("statements that are no runner calls standing beside the its", () => {
    const it = test.extend("extractionBesideStatementsThatAreNoRunnerCalls", () =>
      extractClaims({
        file: SPEC_FILE,
        source: `import { it, describe } from "vite-plus/test";
const shared = 1;
describe("subject", () => {
  const local = shared;
  (() => {})();
  void local;
  it("claim", () => { expect(local).toBe(1); });
});
`,
      }));

    it("ignores them and keeps the claim of the describe", ({
      extractionBesideStatementsThatAreNoRunnerCalls,
    }) => {
      expect(extractionBesideStatementsThatAreNoRunnerCalls).toStrictEqual({
        subjects: [{ subject: "subject", claims: ["claim"] }],
        problems: [],
      });
    });
  });

  describe("an it given no name at all", () => {
    const it = test.extend("extractionOfAnItGivenNoName", () =>
      extractClaims({ file: SPEC_FILE, source: "describe('s', () => { it() });\n" }));

    it("reports the missing literal name and keeps no subject", ({
      extractionOfAnItGivenNoName,
    }) => {
      expect(extractionOfAnItGivenNoName).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: 1, message: COMPUTED_NAME }],
      });
    });
  });

  describe("a describe whose callback is not a function", () => {
    const it = test.extend("extractionOfADescribeWhoseCallbackIsNotAFunction", () =>
      extractClaims({ file: SPEC_FILE, source: "describe('s', 5);\n" }));

    it("reports a subject standing without claims", ({
      extractionOfADescribeWhoseCallbackIsNotAFunction,
    }) => {
      expect(extractionOfADescribeWhoseCallbackIsNotAFunction).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: 1, message: SUBJECT_WITHOUT_CLAIMS }],
      });
    });
  });

  describe("a file holding only a call that is no runner at all", () => {
    const it = test.extend("extractionOfAFileHoldingOnlyANonRunnerCall", () =>
      extractClaims({ file: SPEC_FILE, source: "(() => {})();\n" }));

    it("reports the file as going without subjects", ({
      extractionOfAFileHoldingOnlyANonRunnerCall,
    }) => {
      expect(extractionOfAFileHoldingOnlyANonRunnerCall).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: null, message: FILE_WITHOUT_SUBJECTS }],
      });
    });
  });

  describe("a source the parser rejects", () => {
    const it = test.extend("extractionOfAFileTheParserRejects", () =>
      extractClaims({ file: SPEC_FILE, source: "describe(\n" }));

    it("reports the file as unparsable and reads no subject", ({
      extractionOfAFileTheParserRejects,
    }) => {
      expect(extractionOfAFileTheParserRejects).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: null, message: UNPARSABLE_SOURCE }],
      });
    });
  });

  describe("a describe whose name is computed", () => {
    const it = test.extend("extractionOfADescribeWithAComputedName", () =>
      extractClaims({
        file: SPEC_FILE,
        source: "describe(`t${'x'}`, () => { it('a', () => {}) });\n",
      }));

    it("reports the computed name and keeps no subject", ({
      extractionOfADescribeWithAComputedName,
    }) => {
      expect(extractionOfADescribeWithAComputedName).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: 1, message: COMPUTED_NAME }],
      });
    });
  });

  describe("an it whose name is computed", () => {
    const it = test.extend("extractionOfAnItWithAComputedName", () =>
      extractClaims({
        file: SPEC_FILE,
        source: "describe('s', () => { it(`c${'x'}`, () => {}) });\n",
      }));

    it("reports the computed name and keeps no subject for the describe holding it", ({
      extractionOfAnItWithAComputedName,
    }) => {
      expect(extractionOfAnItWithAComputedName).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: 1, message: COMPUTED_NAME }],
      });
    });
  });

  describe("a claim declared with the test function", () => {
    const it = test.extend("extractionOfAClaimDeclaredWithTheTestFunction", () =>
      extractClaims({
        file: SPEC_FILE,
        source: "describe('s', () => { test('c', () => {}) });\n",
      }));

    it("reports the test function and keeps no subject", ({
      extractionOfAClaimDeclaredWithTheTestFunction,
    }) => {
      expect(extractionOfAClaimDeclaredWithTheTestFunction).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: 1, message: TEST_FUNCTION_CLAIM }],
      });
    });
  });

  describe("a claim declared with the test function on the second line", () => {
    const it = test.extend("extractionOfATestFunctionClaimOnItsOwnLine", () =>
      extractClaims({
        file: SPEC_FILE,
        source: "describe('s', () => {\n  test('c', () => {});\n});\n",
      }));

    it("names the line the problem sits on", ({ extractionOfATestFunctionClaimOnItsOwnLine }) => {
      expect(extractionOfATestFunctionClaimOnItsOwnLine).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: 2, message: TEST_FUNCTION_CLAIM }],
      });
    });
  });

  describe("a describe narrowed through a member", () => {
    const it = test.extend("extractionOfADescribeNarrowedThroughAMember", () =>
      extractClaims({
        file: SPEC_FILE,
        source: "describe.skip('s', () => { it('c', () => {}) });\n",
      }));

    it("reports the narrowed runner and keeps no subject", ({
      extractionOfADescribeNarrowedThroughAMember,
    }) => {
      expect(extractionOfADescribeNarrowedThroughAMember).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: 1, message: NARROWED_RUNNER }],
      });
    });
  });

  describe("an it narrowed through each", () => {
    const it = test.extend("extractionOfAnItNarrowedThroughEach", () =>
      extractClaims({
        file: SPEC_FILE,
        source: "describe('s', () => { it.each([1])('c %i', () => {}) });\n",
      }));

    it("reports the narrowed runner and keeps no subject", ({
      extractionOfAnItNarrowedThroughEach,
    }) => {
      expect(extractionOfAnItNarrowedThroughEach).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: 1, message: NARROWED_RUNNER }],
      });
    });
  });

  describe("a describe holding no claims", () => {
    const it = test.extend("extractionOfADescribeWithNoClaims", () =>
      extractClaims({ file: SPEC_FILE, source: "describe('s', () => {});\n" }));

    it("reports a subject standing without claims", ({ extractionOfADescribeWithNoClaims }) => {
      expect(extractionOfADescribeWithNoClaims).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: 1, message: SUBJECT_WITHOUT_CLAIMS }],
      });
    });
  });

  describe("a file carrying no describe", () => {
    const it = test.extend("extractionOfAFileWithNoDescribe", () =>
      extractClaims({ file: SPEC_FILE, source: "const nothing = 1;\n" }));

    it("reports the file it was given as going without subjects", ({
      extractionOfAFileWithNoDescribe,
    }) => {
      expect(extractionOfAFileWithNoDescribe).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: null, message: FILE_WITHOUT_SUBJECTS }],
      });
    });
  });

  describe("a claim whose name is a number", () => {
    const it = test.extend("extractionOfAClaimWhoseNameIsANumber", () =>
      extractClaims({
        file: SPEC_FILE,
        source: "describe('s', () => { it(5, () => {}) });\n",
      }));

    it("reports it as a name that is no string literal", ({
      extractionOfAClaimWhoseNameIsANumber,
    }) => {
      expect(extractionOfAClaimWhoseNameIsANumber).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: 1, message: COMPUTED_NAME }],
      });
    });
  });

  describe("a describe nested inside another describe", () => {
    const it = test.extend("extractionOfANestedDescribe", () =>
      extractClaims({
        file: SPEC_FILE,
        source: `describe("outer", () => {
  it("kept", () => {});
  describe("inner", () => {
    it("dropped", () => {});
  });
});
`,
      }));

    it("keeps the claims of the outer describe and reports nothing about the nesting", ({
      extractionOfANestedDescribe,
    }) => {
      expect(extractionOfANestedDescribe).toStrictEqual({
        subjects: [{ subject: "outer", claims: ["kept"] }],
        problems: [],
      });
    });
  });

  describe("a describe that was read standing beside one that reported a problem", () => {
    const it = test.extend("extractionBesideADescribeThatReportedAProblem", () =>
      extractClaims({
        file: SPEC_FILE,
        source: `describe("sound", () => {
  it("kept", () => {});
});
describe("broken", () => {
  test("rejected", () => {});
});
`,
      }));

    it("keeps the subject of the one that was read and reports the problem of the other", ({
      extractionBesideADescribeThatReportedAProblem,
    }) => {
      expect(extractionBesideADescribeThatReportedAProblem).toStrictEqual({
        subjects: [{ subject: "sound", claims: ["kept"] }],
        problems: [{ file: SPEC_FILE, line: 5, message: TEST_FUNCTION_CLAIM }],
      });
    });
  });

  describe("a describe whose callback is missing", () => {
    const it = test.extend("extractionOfADescribeWhoseCallbackIsMissing", () =>
      extractClaims({ file: SPEC_FILE, source: "describe('s');\n" }));

    it("reports a subject standing without claims", ({
      extractionOfADescribeWhoseCallbackIsMissing,
    }) => {
      expect(extractionOfADescribeWhoseCallbackIsMissing).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: 1, message: SUBJECT_WITHOUT_CLAIMS }],
      });
    });
  });

  describe("a call whose callee is no runner", () => {
    const it = test.extend("extractionOfACallWhoseCalleeIsNotARunner", () =>
      extractClaims({ file: SPEC_FILE, source: "setup('s', () => {});\n" }));

    it("ignores the call and reports the file as going without subjects", ({
      extractionOfACallWhoseCalleeIsNotARunner,
    }) => {
      expect(extractionOfACallWhoseCalleeIsNotARunner).toStrictEqual({
        subjects: [],
        problems: [{ file: SPEC_FILE, line: null, message: FILE_WITHOUT_SUBJECTS }],
      });
    });
  });
});
