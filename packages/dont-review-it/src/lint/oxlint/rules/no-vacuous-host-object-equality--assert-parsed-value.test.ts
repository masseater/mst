import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noVacuousHostObjectEquality } from "./no-vacuous-host-object-equality--assert-parsed-value.ts";

const SPEC_FILENAME = "order.test.ts";

const SOURCE_FILENAME = "order.ts";

const EQUALITY = { messageId: "vacuousStructuralEquality" };

const PARTIAL_SHAPE = { messageId: "vacuousPartialShape" };

const RECORD = { messageId: "vacuousSnapshotRecord" };

const recordedDir = mkdtempSync(join(tmpdir(), "dont-review-it-no-vacuous-host-object-equality-"));

mkdirSync(join(recordedDir, "__snapshots__"), { recursive: true });

const recordedSpec = join(recordedDir, SPEC_FILENAME);

writeFileSync(
  join(recordedDir, "__snapshots__", `${SPEC_FILENAME}.snap`),
  [
    "// Vitest Snapshot v1",
    "",
    "exports[`outer > names the response 1`] = `Response {}`;",
    "",
    "exports[`outer > names the response 2`] = `{",
    '  "id": 1,',
    "}`;",
    "",
    "exports[`outer > names the headers 1`] = `Headers {}`;",
    "",
  ].join("\n"),
);

writeFileSync(join(recordedDir, "response-record.txt"), "Response {}\n");

writeFileSync(join(recordedDir, "order-record.txt"), '{\n  "id": 1,\n}\n');

const inBlock = (title: string, body: string): string =>
  `describe('outer', () => {\n  it('${title}', () => {\n    ${body}\n  });\n});`;

const repeated = <Reported>(report: Reported, times: number): Reported[] =>
  Array.from({ length: times }, () => report);

describe("dont-review-it/no-vacuous-host-object-equality--assert-parsed-value", () => {
  testLintRule(noVacuousHostObjectEquality, {
    valid: [
      {
        name: "reading the observable surface through the dedicated matcher is the shape this rule keeps",
        code: "expect(response).toHaveParsedFields({ status: 200, headers: {}, body: { id: 1 } });\nexpect(order).toStrictEqual({ id: 1, lines: [] });",
        filename: SPEC_FILENAME,
      },
      {
        name: "a same-named class the file declares carries enumerable state of its own",
        code: "class Response {\n  constructor(body) {\n    this.body = body;\n  }\n}\nexpect(subject).toStrictEqual(new Response('a'));\nexpect(new Response()).toMatchInlineSnapshot(`Response {}`);",
        filename: SPEC_FILENAME,
      },
      {
        name: "a same-named class taken from anywhere but the runtime is the caller's own declaration",
        code: "import { Response } from './http.ts';\nimport { Response as Owned } from 'my-http-kit';\nexpect(subject).toStrictEqual(new Response('a'));\nexpect(subject).toStrictEqual(new Owned('a'));",
        filename: SPEC_FILENAME,
      },
      {
        name: "a counterpart whose prototype differs leaves the comparison to fall on its own",
        code: "function build() {\n  return 1;\n}\nclass Order {}\nexpect({ status: 200 }).toStrictEqual(new Response('a'));\nexpect('ok').toStrictEqual(new Response('a'));\nexpect(2).toEqual(new Response('a'));\nexpect(new Date(0)).toStrictEqual(new Response('a'));\nexpect(build).toStrictEqual(new Response('a'));\nexpect(Order).toStrictEqual(new Response('a'));\nexpect(new Request('https://example.test/')).toStrictEqual(new Response('a'));",
        filename: SPEC_FILENAME,
      },
      {
        name: "positions that do not line up are left undecided rather than guessed",
        code: "expect({ a: new Response('a') }).toStrictEqual({ b: new Response('b') });\nexpect([new Response('a')]).toStrictEqual([new Response('b'), new Response('c')]);\nexpect([, new Response('a')]).toStrictEqual([new Response('b'), new Response('c')]);\nexpect(subject).toStrictEqual({ ...defaults, body: new Response('a') });\nexpect(subject).toStrictEqual({ ...new Response('a') });\nexpect(subject).toStrictEqual({ [field]: new Response('a') });",
        filename: SPEC_FILENAME,
      },
      {
        name: "matchers that can still fall belong to whoever owns their family",
        code: "expect(responses).toContain(new Response('a'));\nexpect(responses).toContainEqual(new Response('a'));\nexpect(responses).toStrictEqual(expect.arrayContaining([new Response('a')]));\nexpect(subject).toBe(new Response('a'));",
        filename: SPEC_FILENAME,
      },
      {
        name: "a name settled at run time is not a name this rule reads",
        code: "expect(subject).toStrictEqual(new globalThis[name]('a'));\nexpect(subject)[matcherName](new Response('a'));\nchecker.toStrictEqual(new Response('a'));\nread();\nmakeExpect()(subject).toStrictEqual(new Response('a'));\nexpect(subject).toStrictEqual(builders.response());",
        filename: SPEC_FILENAME,
      },
      {
        name: "a name that never settles on one value carries no construction this rule can read",
        code: "let expected = new Response('a');\nexpected = other;\nlet pending;\npending = new Response('b');\nconst { taken } = fixtures;\nconst build = (flag) => {\n  if (flag) {\n    return new Response('a');\n  }\n  return new Response('b');\n};\nconst count = 1;\nconst loop = () => loop();\nconst first = second;\nconst second = first;\nexpect(subject).toStrictEqual(expected);\nexpect(subject).toStrictEqual(pending);\nexpect(subject).toStrictEqual(taken);\nexpect(subject).toStrictEqual(build(true));\nexpect(subject).toStrictEqual(count());\nexpect(subject).toStrictEqual(loop());\nexpect(subject).toStrictEqual(first);",
        filename: SPEC_FILENAME,
      },
      {
        name: "a runtime declaration outside the roster is out of range",
        code: "import { FormData } from 'undici';\nimport * as undici from 'undici';\nimport fetch from 'undici';\nexpect(subject).toStrictEqual(new FormData());\nexpect(subject).toStrictEqual(new undici.FormData());",
        filename: SPEC_FILENAME,
      },
      {
        name: "a record that pins the subject, or that is no record at all, is left alone",
        code: "expect(subject).toMatchInlineSnapshot();\nexpect(subject).toMatchInlineSnapshot(`Response ${suffix}`);\nexpect(subject).toMatchInlineSnapshot(`Headers {}`);\nexpect(subject).toMatchInlineSnapshot(`Response { \"status\": 200 }`);\nexpect({ id: 1 }).toMatchInlineSnapshot(`Response {}`);\nexpect(new Request('https://example.test/')).toMatchInlineSnapshot(`Response {}`);\nexpect().toMatchInlineSnapshot(`Response {}`);\nexpect(subject).toMatchInlineSnapshot(...recorded);\nexpect(subject).toMatchInlineSnapshot({ id: expect.any(Number) });",
        filename: SPEC_FILENAME,
      },
      {
        name: "an entry that pins the subject, or that cannot be resolved, is left alone",
        code: [
          "describe('outer', () => {",
          "  it('names the headers', () => {",
          "    expect(subject).toMatchSnapshot();",
          "  });",
          "  it('names nothing recorded', () => {",
          "    expect(subject).toMatchSnapshot();",
          "  });",
          "  it('names the response', () => {",
          '    expect(first).toMatchInlineSnapshot(`{ "id": 1 }`);',
          "    expect(second).toMatchSnapshot();",
          "  });",
          "});",
          "expect(loose).toMatchSnapshot();",
          "await expect(subject).toMatchFileSnapshot('./order-record.txt');",
          "await expect(subject).toMatchFileSnapshot(recordPath);",
          "await expect(subject).toMatchFileSnapshot('./missing-record.txt');",
          "await expect(subject).toMatchFileSnapshot();",
        ].join("\n"),
        filename: recordedSpec,
      },
      {
        name: "a title settled at run time cannot be turned into an entry",
        code: "describe.each([1, 2])('outer %s', () => {\n  it('names the response', () => {\n    expect(subject).toMatchSnapshot();\n  });\n});",
        filename: recordedSpec,
      },
      {
        name: "a file that is not a spec is out of range, since these names mean nothing there",
        code: "expect(subject).toStrictEqual(new Response('a'));",
        filename: SOURCE_FILENAME,
      },
      {
        name: "a repository that spells its specs differently takes this file out of range",
        code: "expect(subject).toStrictEqual(new Response('a'));",
        filename: SPEC_FILENAME,
        options: [{ specFileSuffixes: [".spec.ts"] }],
      },
      {
        name: "a roster that leaves a type out leaves the comparison of that type alone",
        code: "expect(subject).toStrictEqual(new Request('https://example.test/'));",
        filename: SPEC_FILENAME,
        options: [{ hostObjectTypes: ["Response"] }],
      },
    ],
    invalid: [
      {
        name: "a construction on either side is compared against whatever the other side holds",
        code: "expect(subject).toStrictEqual(new Response('a'));\nexpect(subject).toEqual(new Response('a'));\nexpect(new Response('a')).toStrictEqual(subject);\nexpect(new Response('a')).toStrictEqual();\nexpect().toStrictEqual(new Response('a'));\nexpect(read()).toStrictEqual(new Response('a'));\nexpect(order.body).toStrictEqual(new Response('a'));\nexpect(subject).toStrictEqual(new Request('https://example.test/'));",
        filename: SPEC_FILENAME,
        errors: repeated(EQUALITY, 8),
      },
      {
        name: "modifiers, derived entry points and static keys leave the comparison as empty as it was",
        code: "expect(subject).not.toStrictEqual(new Response('a'));\nawait expect(pending).resolves.toStrictEqual(new Response('a'));\nawait expect(pending).rejects.not.toEqual(new Response('a'));\nexpect.soft(subject).toStrictEqual(new Response('a'));\nawait expect.poll(read).toStrictEqual(new Response('a'));\nexpect(subject)['toStrictEqual'](new Response('a'));",
        filename: SPEC_FILENAME,
        errors: repeated(EQUALITY, 6),
      },
      {
        name: "type level wrappers and the standard factories reach the comparison unchanged",
        code: "expect(subject).toStrictEqual(new Response('a') as Response);\nexpect(subject).toStrictEqual(new Response('a')!);\nexpect(subject).toStrictEqual((new Response('a')));\nexpect(subject).toStrictEqual(new Response('a') satisfies Response);\nexpect(subject).toStrictEqual(Response.json({ id: 1 }));\nexpect(subject).toStrictEqual(Response.redirect('/next'));\nexpect(subject).toStrictEqual(Response.error());",
        filename: SPEC_FILENAME,
        errors: repeated(EQUALITY, 7),
      },
      {
        name: "a construction behind a name, behind a call, or nested at a position that lines up is the same value",
        code: "const expected = new Response('a');\nconst build = () => new Response('b');\nexpect(subject).toStrictEqual(expected);\nexpect(subject).toStrictEqual(build());\nexpect({ body: subject }).toStrictEqual({ body: new Response('a') });\nexpect({ 1: subject }).toStrictEqual({ '1': new Response('a') });\nexpect([subject]).toStrictEqual([new Response('a')]);\nexpect(subject).toStrictEqual({ body: new Response('a') });",
        filename: SPEC_FILENAME,
        errors: repeated(EQUALITY, 6),
      },
      {
        name: "a partial shape comparison holds for any subject once its expected value is empty",
        code: "expect(subject).toMatchObject(new Response('a'));\nexpect(subject).toMatchObject({ body: new Response('a') });\nexpect(subject).toStrictEqual(expect.objectContaining(new Response('a')));",
        filename: SPEC_FILENAME,
        errors: repeated(PARTIAL_SHAPE, 3),
      },
      {
        name: "every spelling of the runtime declaration is the same declaration",
        code: "import { Response as HttpResponse } from 'undici';\nimport { 'Response' as TextResponse } from 'undici';\nimport * as undici from 'undici';\nexpect(subject).toStrictEqual(new HttpResponse('a'));\nexpect(subject).toStrictEqual(new TextResponse('a'));\nexpect(subject).toStrictEqual(new undici.Response('a'));\nexpect(subject).toStrictEqual(undici.Response.json({ id: 1 }));",
        filename: SPEC_FILENAME,
        errors: repeated(EQUALITY, 4),
      },
      {
        name: "a record holding a constructor name and an empty body pins nothing",
        code: "expect(subject).toMatchInlineSnapshot(`Response {}`);\nexpect(subject).toMatchInlineSnapshot(`Request {}`);\nexpect(subject).toMatchInlineSnapshot('Response {}');\nexpect(subject).toMatchInlineSnapshot({ id: expect.any(Number) }, `Response {}`);\nexpect.soft(subject).toMatchInlineSnapshot(`Response {}`);",
        filename: SPEC_FILENAME,
        errors: repeated(RECORD, 5),
      },
      {
        name: "a record kept in the external file is read through the entry the assertion writes",
        code: inBlock("names the response", "expect(subject).toMatchSnapshot();"),
        filename: recordedSpec,
        errors: [RECORD],
      },
      {
        name: "entries are counted in the order the assertions run",
        code: inBlock(
          "names the response",
          "expect(first).toMatchSnapshot();\n    expect(second).toMatchSnapshot();",
        ),
        filename: recordedSpec,
        errors: [RECORD],
      },
      {
        name: "a record kept in a file the assertion names is read from that file",
        code: "await expect(subject).toMatchFileSnapshot('./response-record.txt');",
        filename: recordedSpec,
        errors: [RECORD],
      },
      {
        name: "a roster the repository widens brings the added type into range",
        code: "expect(subject).toStrictEqual(new Headers({ a: '1' }));",
        filename: SPEC_FILENAME,
        options: [{ hostObjectTypes: ["Headers"] }],
        errors: [EQUALITY],
      },
      {
        name: "a repository that re-exports the runtime implementation elsewhere can say so",
        code: "import { Response } from '@internal/http';\nexpect(subject).toStrictEqual(new Response('a'));",
        filename: SPEC_FILENAME,
        options: [{ runtimeModules: ["@internal/http"] }],
        errors: [EQUALITY],
      },
      {
        name: "the matcher named as the repair is the one the repository registered",
        code: "expect(subject).toStrictEqual(new Response('a'));",
        filename: SPEC_FILENAME,
        options: [{ parsedValueMatcher: "toHaveHttpFields" }],
        errors: [{ ...EQUALITY, data: { hostType: "Response", matcher: "toHaveHttpFields" } }],
      },
      {
        name: "a matcher name the settings leave empty falls back to the one the rule names",
        code: "expect(subject).toStrictEqual(new Response('a'));",
        filename: SPEC_FILENAME,
        options: [{ parsedValueMatcher: "" }],
        errors: [{ ...EQUALITY, data: { hostType: "Response", matcher: "toHaveParsedFields" } }],
      },
    ],
  });
});
