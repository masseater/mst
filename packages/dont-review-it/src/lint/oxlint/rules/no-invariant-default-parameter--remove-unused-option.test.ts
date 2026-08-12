import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noInvariantDefaultParameter } from "./no-invariant-default-parameter--remove-unused-option.ts";

const productionFile = "packages/example/src/format.ts";

describe("dont-review-it/no-invariant-default-parameter--remove-unused-option", () => {
  testLintRule(noInvariantDefaultParameter, {
    valid: [
      {
        name: "a parameter used with both values carries real variability",
        code: "function format(value, compact = false) { return compact ? String(value) : value; }\nformat(1);\nformat(2, true);",
        filename: productionFile,
      },
      {
        name: "an exported function has call sites outside the file",
        code: "export function format(value, compact = false) { return compact ? String(value) : value; }\nformat(1);",
        filename: productionFile,
      },
      {
        name: "a function passed as a value has call sites that cannot be enumerated",
        code: "function format(value, compact = false) { return compact ? String(value) : value; }\nvalues.map(format);",
        filename: productionFile,
      },
      {
        name: "a named function expression includes recursive calls through its inner binding",
        code: "const walk = function visit(node, deep = false) { return node.child ? visit(node.child, true) : node; };\nwalk(root);",
        filename: productionFile,
      },
      {
        name: "a function declaration can observe whether the defaulted argument was supplied",
        code: "function format(value, compact = false) { return arguments.length; }\nformat(1, false);\nformat(2, false);",
        filename: productionFile,
      },
      {
        name: "a function expression can observe the defaulted argument value through arguments",
        code: "const format = function (value, compact = false) { return arguments[1]; };\nformat(1, false);\nformat(2, false);",
        filename: productionFile,
      },
      {
        name: "a parameter initializer can observe an earlier argument value",
        code: "function format(value = false, fallback = arguments[0]) { return fallback; }\nformat(false);",
        filename: productionFile,
      },
      {
        name: "an earlier initializer cannot read a later parameter before initialization",
        code: "function format(copy = compact, compact = false) { return copy; }\nformat();",
        filename: productionFile,
      },
      {
        name: "direct eval in a function declaration can resolve the parameter binding",
        code: "function format(value, compact = false) { return eval('compact'); }\nformat(1, false);\nformat(2, false);",
        filename: productionFile,
      },
      {
        name: "direct eval in an arrow can resolve the arrow parameter environment",
        code: "const format = (value, compact = false) => eval('compact');\nformat(1, false);\nformat(2, false);",
        filename: productionFile,
      },
      {
        name: "TypeScript wrappers around direct eval still resolve the parameter binding",
        code: "function format(value, compact = false) { return eval!('compact'); }\nformat(1, false);\nfunction formatAs(value, compact = false) { return (eval as typeof eval)('compact'); }\nformatAs(1, false);\nfunction formatSatisfies(value, compact = false) { return (eval satisfies typeof eval)('compact'); }\nformatSatisfies(1, false);\nfunction formatAsserted(value, compact = false) { return (<typeof eval>eval)('compact'); }\nformatAsserted(1, false);",
        filename: productionFile,
      },
      {
        name: "a dynamic argument may vary at runtime",
        code: "function format(value, compact = false) { return compact ? String(value) : value; }\nformat(1);\nformat(2, settings.compact);",
        filename: productionFile,
      },
      {
        name: "a shadowed undefined identifier is an ordinary argument",
        code: "function format(value, compact = false) { return compact ? String(value) : value; }\nfunction invoke(undefined) { return format(1, undefined); }\ninvoke(true);",
        filename: productionFile,
      },
      {
        name: "a spread before the option leaves its effective argument unknown",
        code: "function format(value, compact = false) { return compact ? String(value) : value; }\nformat(...argumentsForFormat);",
        filename: productionFile,
      },
      {
        name: "a spread at the option position leaves its effective argument unknown",
        code: "function format(value, compact = false) { return compact ? String(value) : value; }\nformat(1, ...compactArguments);",
        filename: productionFile,
      },
      {
        name: "a required parameter does not advertise a default option",
        code: "function format(value, compact) { return compact ? String(value) : value; }\nformat(1, false);",
        filename: productionFile,
      },
      {
        name: "a declared signature has no local body to inspect",
        code: "declare function format(value: unknown, compact?: boolean): unknown;",
        filename: productionFile,
      },
      {
        name: "overload signatures preserve an option contract beyond observed calls",
        code: "function format(value: unknown, compact?: boolean): unknown;\nfunction format(value: unknown, compact = false) { return compact ? String(value) : value; }\nformat(1);",
        filename: productionFile,
      },
      {
        name: "an anonymous exported function has no closed local binding",
        code: "export default function (value, compact = false) { return compact ? String(value) : value; }",
        filename: productionFile,
      },
      {
        name: "a named default export has call sites outside the file",
        code: "export default function format(value, compact = false) { return compact ? String(value) : value; }",
        filename: productionFile,
      },
      {
        name: "an uninitialized binding is not a function",
        code: "let format;",
        filename: productionFile,
      },
      {
        name: "a destructured binding is not a named function",
        code: "const [format] = formatters;",
        filename: productionFile,
      },
      {
        name: "a non-function initializer is not a callable declaration",
        code: "const compact = false;",
        filename: productionFile,
      },
      {
        name: "an exported function expression has call sites outside the file",
        code: "export const format = (value, compact = false) => compact ? String(value) : value;\nformat(1);",
        filename: productionFile,
      },
      {
        name: "a reference outside call position makes the call set open",
        code: "function format(value, compact = false) { return compact ? String(value) : value; }\nconst formatter = format;\nformatter(1);",
        filename: productionFile,
      },
      {
        name: "a regex default is not a supported scalar option",
        code: 'function matches(value, pattern = /x/) { return pattern.test(value); }\nmatches("x");',
        filename: productionFile,
      },
      {
        name: "a local function without calls has no observed invariant",
        code: "function format(value, compact = false) { return compact ? String(value) : value; }",
        filename: productionFile,
      },
      {
        name: "a destructured default is not a scalar option",
        code: "function format(value, { compact } = { compact: false }) { return compact ? String(value) : value; }\nformat(1);",
        filename: productionFile,
      },
      {
        name: "positive zero and negative zero are different effective values",
        code: "function classify(value = -0) { return Object.is(value, -0); }\nclassify();\nclassify(0);",
        filename: productionFile,
      },
      {
        name: "a non-finite signed numeric literal is outside the supported scalar values",
        code: "function normalize(value = -1e400) { return value; }\nnormalize();",
        filename: productionFile,
      },
      {
        name: "unsupported unary and non-finite defaults do not become static values",
        code: 'function invert(value = !0) { return value; }\ninvert();\nfunction dynamic(value = -settings.offset) { return value; }\ndynamic();\nfunction coerced(value = -"1") { return value; }\ncoerced();\nfunction infinite(value = 1e400) { return value; }\ninfinite();',
        filename: productionFile,
      },
      {
        name: "test helpers are outside the production abstraction rule",
        code: "function format(value, compact = false) { return compact ? String(value) : value; }\nformat(1);",
        filename: "packages/example/src/format.test.ts",
      },
    ],
    invalid: [
      {
        name: "an erased this parameter does not shift the runtime option argument",
        code: "function format(this: void, compact = false) { return compact; }\nformat(true);",
        filename: productionFile,
        errors: [
          {
            messageId: "invariantDefaultParameter",
            data: { name: "compact", value: "true" },
          },
        ],
      },
      {
        name: "an omitted option at every call site is fixed to its default",
        code: "function format(value, compact = false) { return compact ? String(value) : value; }\nformat(1);\nformat(2);",
        filename: productionFile,
        errors: [
          {
            messageId: "invariantDefaultParameter",
            data: { name: "compact", value: "false" },
          },
        ],
      },
      {
        name: "explicitly passing the default does not create variability",
        code: "function format(value, compact = false) { return compact ? String(value) : value; }\nformat(1);\nformat(2, false);",
        filename: productionFile,
        errors: [{ messageId: "invariantDefaultParameter" }],
      },
      {
        name: "a later initializer reads the fixed earlier parameter through its resolved binding",
        code: "function format(compact = false, copy = compact) { return copy; }\nformat(false);",
        filename: productionFile,
        errors: [
          {
            messageId: "invariantDefaultParameter",
            data: { name: "compact", value: "false" },
          },
        ],
      },
      {
        name: "an explicit value at every call site makes the unused default irrelevant",
        code: "const format = (value, compact = false) => compact ? String(value) : value;\nformat(1, true);\nformat(2, true);",
        filename: productionFile,
        errors: [
          {
            messageId: "invariantDefaultParameter",
            data: { name: "compact", value: "true" },
          },
        ],
      },
      {
        name: "global undefined selects the default value",
        code: "const format = function (value, compact = false) { return compact ? String(value) : value; };\nformat(1, undefined);",
        filename: productionFile,
        errors: [{ messageId: "invariantDefaultParameter" }],
      },
      {
        name: "a named function expression without recursive variability is still reported",
        code: "const format = function render(value, compact = false) { return compact ? String(value) : value; };\nformat(1);",
        filename: productionFile,
        errors: [{ messageId: "invariantDefaultParameter" }],
      },
      {
        name: "arguments inside an arrow belongs to its outer function and does not open the arrow call set",
        code: "function outer() { const format = (value, compact = false) => arguments.length + Number(compact); format(1, false); }",
        filename: productionFile,
        errors: [{ messageId: "invariantDefaultParameter" }],
      },
      {
        name: "a shadowed eval name is an ordinary closed local call",
        code: "const eval = () => false;\nfunction format(value, compact = false) { return eval('compact') || compact; }\nformat(1, false);",
        filename: productionFile,
        errors: [{ messageId: "invariantDefaultParameter" }],
      },
      {
        name: "indirect global eval cannot resolve the function parameter binding",
        code: "function format(value, compact = false) { return (0, eval)('compact') || compact; }\nformat(1, false);",
        filename: productionFile,
        errors: [{ messageId: "invariantDefaultParameter" }],
      },
      {
        name: "optional eval is indirect and cannot resolve the function parameter binding",
        code: "function format(value, compact = false) { return eval?.('compact') || compact; }\nformat(1, false);",
        filename: productionFile,
        errors: [{ messageId: "invariantDefaultParameter" }],
      },
      {
        name: "each independently fixed default parameter is reported",
        code: "const format = (value, compact = false, radix = 10) => compact ? String(value) : value.toString(radix);\nformat(1);\nformat(2);",
        filename: productionFile,
        errors: [
          { messageId: "invariantDefaultParameter" },
          { messageId: "invariantDefaultParameter" },
        ],
      },
      {
        name: "a fixed negative numeric option is reported",
        code: "function offset(value = -1) { return value; }\noffset();\noffset(-1);",
        filename: productionFile,
        errors: [
          {
            messageId: "invariantDefaultParameter",
            data: { name: "value", value: "-1" },
          },
        ],
      },
      {
        name: "a fixed explicitly positive numeric option is reported",
        code: "function offset(value = +1) { return value; }\noffset(+1);",
        filename: productionFile,
        errors: [
          {
            messageId: "invariantDefaultParameter",
            data: { name: "value", value: "+1" },
          },
        ],
      },
      {
        name: "negative zero remains the reported effective value",
        code: "function classify(value = -0) { return Object.is(value, -0); }\nclassify();\nclassify(-0);",
        filename: productionFile,
        errors: [
          {
            messageId: "invariantDefaultParameter",
            data: { name: "value", value: "-0" },
          },
        ],
      },
    ],
  });
});
