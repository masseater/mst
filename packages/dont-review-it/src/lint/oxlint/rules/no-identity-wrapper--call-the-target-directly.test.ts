import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noIdentityWrapper } from "./no-identity-wrapper--call-the-target-directly.ts";

describe("dont-review-it/no-identity-wrapper--call-the-target-directly", () => {
  testLintRule(noIdentityWrapper, {
    valid: [
      {
        name: "a function that does work of its own is not a wrapper",
        code: "const parseUser = (input) => JSON.parse(input).user;",
      },
      {
        name: "a binding taken apart by a pattern is not a named function",
        code: "const [parseUser] = parsers;",
      },
      {
        name: "a binding declared without a value is not a named function",
        code: "let parseUser;",
      },
      {
        name: "a block body that returns nothing is not a forwarding call",
        code: "const parseUser = (input) => {\n  record(input);\n};",
      },
      {
        name: "a rest parameter taken apart by a pattern forwards no name",
        code: "function parseUser(...[input]) {\n  return parse(...[input]);\n}",
      },
      {
        name: "spreading something other than a parameter is not forwarding it",
        code: "function parseUser(input) {\n  return parse(...[input]);\n}",
      },
      {
        name: "a function declared without a body forwards nothing",
        code: "declare function parseUser(input: string): unknown;",
      },
      {
        name: "a call that adds an argument is a partial application and not a pass through",
        code: "const parseUser = (input) => parse(input, DEFAULT_OPTIONS);",
      },
      {
        name: "a call that takes a property off a parameter transforms it",
        code: "const findUser = (record) => find(record.id);",
      },
      {
        name: "a call that reorders the parameters is not a pass through",
        code: "const swap = (left, right) => join(right, left);",
      },
      {
        name: "a call that drops a parameter is not a pass through",
        code: "const parseUser = (input, options) => parse(input);",
      },
      {
        name: "a body with a statement beside the call is not a pass through",
        code: "const parseUser = (input) => {\n  record(input);\n  return parse(input);\n};",
      },
      {
        name: "a return type annotation declares a contract at this boundary",
        code: "const parseUser = (input: string): User => parse(input);",
      },
      {
        name: "a type annotation on the binding declares a contract at this boundary",
        code: "const parseUser: ParseUser = (input) => parse(input);",
      },
      {
        name: "a function declaration with a return type annotation declares a contract",
        code: "function parseUser(input: string): User {\n  return parse(input);\n}",
      },
      {
        name: "type parameters of its own make the call site decide the type",
        code: "const parseUser = <Parsed>(input) => parse(input);",
      },
      {
        name: "type arguments on the forwarded call declare the type it produces",
        code: "const parseUser = (input) => parse<User>(input);",
      },
      {
        name: "an async function changes the contract to a promise by construction",
        code: "const parseUser = async (input) => parse(input);",
      },
      {
        name: "a generator changes the contract to a sequence by construction",
        code: "function* parseUser(input) {\n  yield parse(input);\n}",
      },
      {
        name: "constructing a value is not the same as calling the target",
        code: "const parseUser = (input) => new Parser(input);",
      },
      {
        name: "calling a parameter is applying what was handed in, not forwarding to a target",
        code: "const runWith = (run, input) => run(input);",
      },
      {
        name: "an inline callback is left to the call it is written in",
        code: "const parsed = inputs.map((input) => parse(input));",
      },
      {
        name: "an object property holding a forwarding function is not a named binding",
        code: "const handlers = { parseUser: (input) => parse(input) };",
      },
      {
        name: "a destructured parameter takes the value apart before forwarding it",
        code: "const parseUser = ({ input }) => parse(input);",
      },
      {
        name: "a defaulted parameter supplies a value the target never sees otherwise",
        code: "const parseUser = (input = EMPTY) => parse(input);",
      },
      {
        name: "an optional call is a different call than the target",
        code: "const parseUser = (input) => parse?.(input);",
      },
      {
        name: "re-exporting the name forwards the definition instead of copying its shape",
        code: "export { parseUser } from './parse-user.ts';",
      },
    ],
    invalid: [
      {
        name: "an arrow that forwards its only parameter is reported",
        code: "const parseUser = (input) => parse(input);",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "a block body whose only statement returns the forwarded call is reported",
        code: "const parseUser = (input) => {\n  return parse(input);\n};",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "a function declaration that forwards its parameters is reported",
        code: "function parseUser(input) {\n  return parse(input);\n}",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "a function expression bound to a name is reported",
        code: "const parseUser = function (input) {\n  return parse(input);\n};",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "forwarding several parameters in the same order is reported",
        code: "const parseUser = (input, options) => parse(input, options);",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "forwarding no parameters at all is a second name for the same call",
        code: "const loadUsers = () => fetchUsers();",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "spreading a rest parameter into the target forwards every argument",
        code: "const parseUser = (...inputs) => parse(...inputs);",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "forwarding to a member of another object is still a second name",
        code: "const parseUser = (input) => parser.parse(input);",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "parameter type annotations alone declare nothing about what comes back",
        code: "const parseUser = (input: string) => parse(input);",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "exporting the wrapper does not make it a re-export",
        code: "export const parseUser = (input) => parse(input);",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "renaming an imported name through a wrapper is reported, not exempted",
        code: "import { parse } from './parse.ts';\nexport const parseUser = (input) => parse(input);",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "a wrapper in a file that only forwards names is reported like any other",
        code: "export const parseUser = (input) => parse(input);",
        filename: "/repo/packages/repository-checks/src/index.ts",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "parentheses around the forwarded call do not change the shape",
        code: "const parseUser = (input) => (parse(input));",
        errors: [{ messageId: "identityWrapper" }],
      },
      {
        name: "each wrapper in a file is reported on its own",
        code: "const parseUser = (input) => parse(input);\nconst formatUser = (user) => format(user);",
        errors: [{ messageId: "identityWrapper" }, { messageId: "identityWrapper" }],
      },
    ],
  });
});
