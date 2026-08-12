import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noAmbiguousVariableName } from "./no-ambiguous-variable-name--rename-to-concrete-noun.ts";

describe("dont-review-it/no-ambiguous-variable-name--rename-to-concrete-noun", () => {
  testLintRule(noAmbiguousVariableName, {
    valid: [
      {
        name: "an object pattern takes its names from the shape it destructures",
        code: "const { data } = payload;",
      },
      {
        name: "an object property name is not a binding",
        code: "const report = { data: 1, result: 2 };",
      },
      {
        name: "a caught binding is named by the catch clause",
        code: "try {\n  run();\n} catch (res) {\n  throw res;\n}",
      },
      {
        name: "a name that merely contains a forbidden word still names its subject",
        code: "const interval = 30;\nconst defaultValue = 0;\nconst metadata = read();\nconst resultCount = 3;",
      },
      {
        name: "a subject in front of an output word keeps the name concrete",
        code: "const gitOutput = run();",
      },
      {
        name: "a subject after a decoration survives",
        code: "const currentUser = load();",
      },
      {
        name: "a computed class field is named by the key expression",
        code: "class Report {\n  [fieldName] = 1;\n}",
      },
    ],
    invalid: [
      {
        name: "the default vocabulary applies without any configuration",
        code: "const data = load();",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "data" } }],
      },
      {
        name: "a binding without an initializer is reported",
        code: "let result;",
        errors: [{ messageId: "ambiguousVariableName" }],
      },
      {
        name: "the declaration keyword does not change the judgement",
        code: "var val = 1;",
        errors: [{ messageId: "ambiguousVariableName" }],
      },
      {
        name: "matching ignores the case the name was written in",
        code: "const Data = load();",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "Data" } }],
      },
      {
        name: "a compound name ending in a bag word is reported on the name itself",
        code: "const parseResult = parse(source);",
        errors: [
          {
            messageId: "ambiguousVariableName",
            data: { name: "parseResult" },
            line: 1,
            column: 6,
            endColumn: 17,
          },
        ],
      },
      {
        name: "the binding of a for-of head is reported",
        code: "for (const value of lines) {\n  use(value);\n}",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "value" } }],
      },
      {
        name: "each declarator of one statement is reported on its own",
        code: "const data = 1,\n  res = 2;",
        errors: [{ messageId: "ambiguousVariableName" }, { messageId: "ambiguousVariableName" }],
      },
      {
        name: "a decoration in front of a forbidden word does not rescue the name",
        code: "const theData = load();",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "theData" } }],
      },
      {
        name: "a number after a forbidden word does not rescue the name",
        code: "const res2 = load();",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "res2" } }],
      },
      {
        name: "a separator around a forbidden word does not rescue the name",
        code: "const _data = load();",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "_data" } }],
      },
      {
        name: "a function parameter is a name its author chooses",
        code: "function render(data: string) {\n  return data;\n}",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "data" } }],
      },
      {
        name: "an arrow function parameter is a name its author chooses",
        code: "const toLabel = (value: string) => value;",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "value" } }],
      },
      {
        name: "a parameter with a default is reported on the binding",
        code: "const toLabel = (item = 1) => item;",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "item" } }],
      },
      {
        name: "a rest parameter is reported on the binding",
        code: "const join = (...args: string[]) => args.join('');",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "args" } }],
      },
      {
        name: "a class field is a name its author chooses",
        code: "class Report {\n  data = 1;\n}",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "data" } }],
      },
      {
        name: "a renamed destructuring binding is a name its author chooses",
        code: "const { parsed: entry } = payload;",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "entry" } }],
      },
      {
        name: "an array pattern names its bindings by position, not by shape",
        code: "const [value] = lines;",
        errors: [{ messageId: "ambiguousVariableName", data: { name: "value" } }],
      },
      {
        name: "a configured pattern is added on top of the default vocabulary",
        code: "const bucket = load();\nconst data = load();",
        options: [[{ pattern: "^bucket$" }]],
        errors: [
          { messageId: "ambiguousVariableName", data: { name: "bucket" } },
          { messageId: "ambiguousVariableName", data: { name: "data" } },
        ],
      },
    ],
  });
});
