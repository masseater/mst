import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { FORBIDDEN_AMBIGUOUS_NAMES } from "../../lib/forbidden-ambiguous-names.ts";
import { noExpectForbiddenSubjectName } from "./no-expect-forbidden-subject-name--rename-to-concrete-subject.ts";

const SPEC_FILE = "report.test.ts";

const SHARED_VOCABULARY = { forbiddenSubjectNames: [...FORBIDDEN_AMBIGUOUS_NAMES] };

const reported = { messageId: "forbiddenSubjectName" };

describe("dont-review-it/no-expect-forbidden-subject-name--rename-to-concrete-subject", () => {
  testLintRule(noExpectForbiddenSubjectName, {
    valid: [
      {
        name: "a file outside the spec suffixes is not inspected",
        filename: "report.ts",
        code: "expect(data).toBe(1);",
        options: [SHARED_VOCABULARY],
      },
      {
        name: "a subject named after the artefact it holds is read as a subject",
        documented: true,
        filename: SPEC_FILE,
        code: 'expect(fetchedReport).toStrictEqual({ status: 200 });\nexpect(renderedText).toBe("ok");',
        options: [SHARED_VOCABULARY],
      },
      {
        name: "a name that merely contains a forbidden word still names its subject",
        filename: SPEC_FILE,
        code: "expect(interval).toBe(30);\nexpect(metadata).toStrictEqual({});\nexpect(resultCount).toBe(3);",
        options: [SHARED_VOCABULARY],
      },
      {
        name: "a property key is a label rather than the subject",
        documented: true,
        filename: SPEC_FILE,
        code: "expect({ data: fetchedReport }).toStrictEqual({ data: 1 });",
        options: [SHARED_VOCABULARY],
      },
      {
        name: "a member name is written by the shape of the value rather than chosen by the spec",
        filename: SPEC_FILE,
        code: "expect(fetchedReport.result).toBe(1);",
        options: [SHARED_VOCABULARY],
      },
      {
        name: "a binding no assertion receives is left to the declaration side",
        filename: SPEC_FILE,
        code: "const result = parse(source);\nexpect(parsedConfig).toBe(1);",
        options: [SHARED_VOCABULARY],
      },
      {
        name: "a call that is not an assertion entry carries no subject",
        filename: SPEC_FILE,
        code: "verify(data);",
        options: [SHARED_VOCABULARY],
      },
      {
        name: "an assertion entry handed nothing carries no subject",
        filename: SPEC_FILE,
        code: "expect();",
        options: [SHARED_VOCABULARY],
      },
      {
        name: "an assertion without a matcher keeps a concrete subject",
        filename: SPEC_FILE,
        code: "expect(fetchedReport);",
        options: [SHARED_VOCABULARY],
      },
      {
        name: "a spread of a concrete binding keeps its subject",
        filename: SPEC_FILE,
        code: "expect([...lines]).toStrictEqual([]);",
        options: [SHARED_VOCABULARY],
      },
      {
        name: "a subject written out in the spec carries no name",
        filename: SPEC_FILE,
        code: 'expect("ok").toBe("ok");',
        options: [SHARED_VOCABULARY],
      },
    ],
    invalid: [
      {
        name: "a container word handed to an assertion is reported on the name itself",
        documented: true,
        filename: SPEC_FILE,
        code: "expect(data).toBe(1);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" }, line: 1, column: 7, endColumn: 11 }],
      },
      {
        name: "the entry is the assertion itself rather than the matcher behind it",
        filename: SPEC_FILE,
        code: "expect(data);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "a soft receiver is read as the same entry",
        filename: SPEC_FILE,
        code: "expect.soft(data).toBe(1);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "a receiver spelled in bracket notation is read as the same entry",
        filename: SPEC_FILE,
        code: 'expect["soft"](data).toBe(1);',
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "a polled subject is read through the thunk it is returned from",
        filename: SPEC_FILE,
        code: "expect.poll(() => data).toBe(1);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "a thunk with a block body is read through what it returns",
        filename: SPEC_FILE,
        code: "expect(() => {\n  return values;\n}).toThrow();",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "values" } }],
      },
      {
        name: "a compound name ending in a bag word is reported",
        documented: true,
        filename: SPEC_FILE,
        code: 'expect(parseResult).toStrictEqual({ id: "a" });',
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "parseResult" } }],
      },
      {
        name: "matching ignores the case the name was written in",
        filename: SPEC_FILE,
        code: "expect(Data).toBe(1);\nexpect(parsedRESULT).toBe(2);",
        options: [SHARED_VOCABULARY],
        errors: [
          { ...reported, data: { name: "Data" } },
          { ...reported, data: { name: "parsedRESULT" } },
        ],
      },
      {
        name: "the receiver of a member read is the name the assertion carries",
        filename: SPEC_FILE,
        code: 'expect(result.id).toBe("a");',
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "result" }, line: 1, column: 7, endColumn: 13 }],
      },
      {
        name: "a computed member key is read as a value",
        filename: SPEC_FILE,
        code: "expect(report[data]).toBe(1);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "a value nested in an object subject is read",
        filename: SPEC_FILE,
        code: "expect({ id: data }).toStrictEqual({ id: 1 });",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "a computed object key is read as a value",
        filename: SPEC_FILE,
        code: "expect({ [data]: 1 }).toStrictEqual({ a: 1 });",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "a binding spread into an object subject is read",
        filename: SPEC_FILE,
        code: "expect({ ...data }).toStrictEqual({});",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "an array element is read",
        filename: SPEC_FILE,
        code: "expect([data]).toStrictEqual([1]);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "an element after a hole is read",
        filename: SPEC_FILE,
        code: "expect([, data]).toStrictEqual([undefined, 1]);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "an argument of a call inside the assertion is read",
        filename: SPEC_FILE,
        code: "expect(normalise(data)).toBe(1);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "the receiver of a called member is read",
        filename: SPEC_FILE,
        code: "expect(result.at(0)).toBe(1);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "result" } }],
      },
      {
        name: "an argument of a constructor inside the assertion is read",
        filename: SPEC_FILE,
        code: "expect(new Report(data)).toStrictEqual({});",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "an interpolation of a tagged template is read",
        filename: SPEC_FILE,
        code: 'expect(sql`select ${data}`).toBe("select 1");',
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "an interpolation of a template is read",
        filename: SPEC_FILE,
        code: 'expect(`${data}`).toBe("1");',
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "each term of a conditional is read",
        filename: SPEC_FILE,
        code: "expect(loaded ? data : fallback).toBe(1);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "each term of a logical expression is read",
        filename: SPEC_FILE,
        code: "expect(data ?? res).toBe(1);",
        options: [SHARED_VOCABULARY],
        errors: [
          { ...reported, data: { name: "data" } },
          { ...reported, data: { name: "res" } },
        ],
      },
      {
        name: "each term of a binary expression is read",
        filename: SPEC_FILE,
        code: "expect(data + 1).toBe(2);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "a private field named on the left of a membership test carries no subject name",
        filename: SPEC_FILE,
        code: "class Report {\n  #id = 1;\n  static holds(data) {\n    expect(#id in data).toBe(true);\n  }\n}",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "the term of a unary expression is read",
        filename: SPEC_FILE,
        code: "expect(!data).toBe(false);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "each term of a sequence is read",
        filename: SPEC_FILE,
        code: "expect((load(), data)).toBe(1);",
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "an awaited subject is the subject",
        filename: SPEC_FILE,
        code: 'test("carries the id", async () => {\n  expect(await data).toBe(1);\n});',
        options: [SHARED_VOCABULARY],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "a repository that spells its specs differently is inspected the same way",
        filename: "report.spec.ts",
        code: "expect(data).toBe(1);",
        options: [{ ...SHARED_VOCABULARY, specFileSuffixes: [".spec.ts"] }],
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "the default vocabulary applies without any configuration",
        filename: SPEC_FILE,
        code: "expect(data).toBe(1);",
        errors: [{ ...reported, data: { name: "data" } }],
      },
      {
        name: "a configured pattern is added on top of the default vocabulary",
        filename: SPEC_FILE,
        code: "expect(bucket).toBe(1);\nexpect(data).toBe(2);",
        options: [{ forbiddenSubjectNames: [{ pattern: "^bucket$" }] }],
        errors: [
          { ...reported, data: { name: "bucket" } },
          { ...reported, data: { name: "data" } },
        ],
      },
    ],
  });
});
