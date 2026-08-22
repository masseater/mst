import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noUncheckedCast } from "./no-unchecked-cast--parse-at-boundary.ts";

const ANY_ANNOTATION = [":", "any"].join(" ");

const THROUGH_ANY = ["as", "any"].join(" ");

const THROUGH_UNKNOWN = ["as", "unknown"].join(" ");

const ANY_BINDING = `const loose${ANY_ANNOTATION} = read();`;

const UNKNOWN_BINDING = "const loose: unknown = read();";

describe("dont-review-it/no-unchecked-cast--parse-at-boundary", () => {
  testLintRule(noUncheckedCast, {
    valid: [
      {
        name: "source that hands no type to a value passes",
        code: "const total: number = 1 + 2;",
      },
      {
        name: "an assertion on a value with a declared shape keeps the compatibility step",
        code: "const input: string = read();\nconst total = input as number;",
      },
      {
        name: "an assertion to unknown claims nothing concrete",
        code: `${ANY_BINDING}\nconst held = loose ${THROUGH_UNKNOWN};`,
      },
      {
        name: "an assertion to any claims nothing concrete",
        code: `${UNKNOWN_BINDING}\nconst held = loose ${THROUGH_ANY};`,
      },
      {
        name: "a const assertion names no type of its own",
        code: `${ANY_BINDING}\nconst held = loose as const;`,
      },
      {
        name: "an assertion standing on another assertion belongs to the stacked rule",
        code: `${ANY_BINDING}\nconst row = loose ${THROUGH_UNKNOWN} as Row;`,
      },
      {
        name: "a value a parse hands back is bound to the type that parse returns",
        code: "const row: Row = parseRow(given);",
      },
      {
        name: "an assertion on a name this file does not declare is left alone",
        code: "const row = imported as Row;",
      },
      {
        name: "a value bound from a call carries no declared looseness",
        code: "const loose = read();\nconst row = loose as Row;",
      },
      {
        name: "a value bound with neither a type nor a value carries no declared looseness",
        code: "let held;\nconst row = held as Row;",
      },
      {
        name: "a name bound to a function carries the shape of that function",
        code: "function read() {}\nconst row = read as Row;",
      },
      {
        name: "two names bound to each other resolve to no declared type",
        code: "const first = second;\nconst second = first;\nconst row = first as Row;",
      },
      {
        name: "an unknown value bound to a concrete annotation is refused by the type checker",
        code: `${UNKNOWN_BINDING}\nconst row: Row = loose;`,
      },
      {
        name: "a destructured binding carries no name for this rule to place",
        code: `${ANY_BINDING}\nconst { id }: Row = loose;`,
      },
      {
        name: "a declaration without a value hands nothing over",
        code: "let row: Row;",
      },
      {
        name: "a class field without a value hands nothing over",
        code: "class Holder {\n  row: Row;\n}",
      },
      {
        name: "a class field taking a value from a call hands over no declared looseness",
        code: "class Holder {\n  row: Row = makeRow();\n}",
      },
      {
        name: "a class field without an annotation names no type to hand over",
        code: `${ANY_BINDING}\nclass Holder {\n  row = loose;\n}`,
      },
      {
        name: "an arrow without a return annotation names no type to hand over",
        code: `${ANY_BINDING}\nconst read = () => loose;`,
      },
      {
        name: "a return carrying no value hands nothing over",
        code: "const read = (): void => {\n  return;\n};",
      },
      {
        name: "a return inside a function without a return annotation hands nothing over",
        code: `const read = (loose${ANY_ANNOTATION}) => {\n  return loose;\n};`,
      },
      {
        name: "a block bodied arrow is read through its return statement",
        code: "const read = (): Row => {\n  return makeRow();\n};",
      },
      {
        name: "a checking function that reads the value it is given passes",
        code: 'const isRow = (value: unknown): value is Row => typeof value === "object";',
      },
      {
        name: "a checking function that reads the value inside a block passes",
        code: "function isRow(value: unknown): value is Row {\n  return value !== null;\n}",
      },
      {
        name: "a declared checking function carries no body to read",
        code: "declare function isCell(value: unknown): value is Cell;",
      },
      {
        name: "a function type spells a predicate without carrying a body",
        code: "type Guard = (value: unknown) => value is Cell;",
      },
      {
        name: "a predicate about this leaves no parameter to read",
        code: "class Holder {\n  isReady(): this is Ready {\n    return true;\n  }\n}",
      },
    ],
    invalid: [
      {
        name: "an any value handed a named type by assertion is reported",
        code: `${ANY_BINDING}\nconst row = loose as Row;`,
        errors: [{ messageId: "uncheckedCast" }],
      },
      {
        name: "an unknown value handed a named type by assertion is reported",
        code: `${UNKNOWN_BINDING}\nconst row = loose as Row;`,
        errors: [{ messageId: "uncheckedCast" }],
      },
      {
        name: "an angle bracket assertion is the same claim and is reported",
        code: `${ANY_BINDING}\nconst row = <Row>loose;`,
        errors: [{ messageId: "uncheckedCast" }],
      },
      {
        name: "a union of named types is a concrete claim and is reported",
        code: `${ANY_BINDING}\nconst row = loose as Row | Cell;`,
        errors: [{ messageId: "uncheckedCast" }],
      },
      {
        name: "a non null suffix leaves the claim standing and is reported",
        code: `${ANY_BINDING}\nconst row = loose! as Row;`,
        errors: [{ messageId: "uncheckedCast" }],
      },
      {
        name: "a claim reached through a second binding is reported",
        code: `${ANY_BINDING}\nconst held = loose;\nconst row = held as Row;`,
        errors: [{ messageId: "uncheckedCast" }],
      },
      {
        name: "a parameter declared any and asserted in the body is reported",
        code: `const use = (loose${ANY_ANNOTATION}): void => {\n  take(loose as Row);\n};`,
        errors: [{ messageId: "uncheckedCast" }],
      },
      {
        name: "a helper taking unknown and asserting the type it returns is reported at the assertion",
        code: "const toRow = (value: unknown): Row => value as Row;",
        errors: [{ messageId: "uncheckedCast" }],
      },
      {
        name: "an any value handed a named type by annotation is reported",
        code: `${ANY_BINDING}\nconst row: Row = loose;`,
        errors: [{ messageId: "uncheckedTypeClaim" }],
      },
      {
        name: "an any value handed a named type by a class field annotation is reported",
        code: `${ANY_BINDING}\nclass Holder {\n  row: Row = loose;\n}`,
        errors: [{ messageId: "uncheckedTypeClaim" }],
      },
      {
        name: "an any value returned into a declared return type is reported",
        code: `const read = (loose${ANY_ANNOTATION}): Row => {\n  return loose;\n};`,
        errors: [{ messageId: "uncheckedTypeClaim" }],
      },
      {
        name: "an any value carried by an arrow without a block is reported",
        code: `const read = (loose${ANY_ANNOTATION}): Row => loose;`,
        errors: [{ messageId: "uncheckedTypeClaim" }],
      },
      {
        name: "a predicate whose body never reads the parameter is reported",
        code: "const isRow = (value: unknown): value is Row => true;",
        errors: [{ messageId: "unexaminedTypePredicate" }],
      },
      {
        name: "an assertion signature whose body never reads the parameter is reported",
        code: "function assertRow(value: unknown): asserts value is Row {}",
        errors: [{ messageId: "unexaminedTypePredicate" }],
      },
      {
        name: "a predicate naming something the function never takes is reported",
        code: "const isRow = (value: unknown): other is Row => true;",
        errors: [{ messageId: "unexaminedTypePredicate" }],
      },
      {
        name: "a predicate reading the parameter only outside the body is reported",
        code: "const seen = value;\nfunction isRow(value: unknown): value is Row {\n  return true;\n}",
        errors: [{ messageId: "unexaminedTypePredicate" }],
      },
    ],
  });
});
