import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { FORBIDDEN_AMBIGUOUS_NAMES } from "../lib/forbidden-ambiguous-names.ts";
import { noAmbiguousVariableName } from "./no-ambiguous-variable-name--rename-to-concrete-noun.ts";

const defaultVocabulary = [...FORBIDDEN_AMBIGUOUS_NAMES];

describe("dont-review-it/no-ambiguous-variable-name--rename-to-concrete-noun", () => {
  testLintRule(noAmbiguousVariableName, {
    valid: [
      {
        name: "without a configured vocabulary the rule inspects nothing",
        code: "const data = load();",
      },
      {
        name: "an empty vocabulary inspects nothing",
        code: "const data = load();",
        options: [[]],
      },
      {
        name: "an object pattern takes its names from the shape it destructures",
        code: "const { data } = payload;",
        options: [defaultVocabulary],
      },
      {
        name: "an array pattern takes its names from the shape it destructures",
        code: "const [value] = entries;",
        options: [defaultVocabulary],
      },
      {
        name: "a function parameter follows the contract of its callers",
        code: "function render(data: string) {\n  return data;\n}",
        options: [defaultVocabulary],
      },
      {
        name: "an arrow function parameter follows the contract of its callers",
        code: "const toLabel = (value: string) => value;",
        options: [defaultVocabulary],
      },
      {
        name: "a class field is not a variable binding",
        code: "class Report {\n  data = 1;\n}",
        options: [defaultVocabulary],
      },
      {
        name: "an object property name is not a variable binding",
        code: "const report = { data: 1, result: 2 };",
        options: [defaultVocabulary],
      },
      {
        name: "a caught binding is not a variable binding",
        code: "try {\n  run();\n} catch (res) {\n  throw res;\n}",
        options: [defaultVocabulary],
      },
      {
        name: "a name that merely contains a forbidden word still names its subject",
        code: "const interval = 30;\nconst defaultValue = 0;\nconst metadata = read();\nconst resultCount = 3;",
        options: [defaultVocabulary],
      },
    ],
    invalid: [
      {
        name: "a container word used as the whole name is reported",
        code: "const data = load();",
        options: [defaultVocabulary],
        errors: [{ messageId: "ambiguousVariableName", data: { name: "data" } }],
      },
      {
        name: "a binding without an initializer is reported",
        code: "let result;",
        options: [defaultVocabulary],
        errors: [{ messageId: "ambiguousVariableName" }],
      },
      {
        name: "the declaration keyword does not change the judgement",
        code: "var val = 1;",
        options: [defaultVocabulary],
        errors: [{ messageId: "ambiguousVariableName" }],
      },
      {
        name: "matching ignores the case the name was written in",
        code: "const Data = load();",
        options: [defaultVocabulary],
        errors: [{ messageId: "ambiguousVariableName", data: { name: "Data" } }],
      },
      {
        name: "a compound name ending in a bag word is reported on the name itself",
        code: "const parseResult = parse(input);",
        options: [defaultVocabulary],
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
        code: "for (const value of entries) {\n  use(value);\n}",
        options: [defaultVocabulary],
        errors: [{ messageId: "ambiguousVariableName", data: { name: "value" } }],
      },
      {
        name: "each declarator of one statement is reported on its own",
        code: "const data = 1,\n  res = 2;",
        options: [defaultVocabulary],
        errors: [{ messageId: "ambiguousVariableName" }, { messageId: "ambiguousVariableName" }],
      },
      {
        name: "a configured vocabulary of one pattern reports only that pattern",
        code: "const payload = load();\nconst data = load();",
        options: [[{ pattern: "^payload$" }]],
        errors: [{ messageId: "ambiguousVariableName", data: { name: "payload" } }],
      },
    ],
  });
});
