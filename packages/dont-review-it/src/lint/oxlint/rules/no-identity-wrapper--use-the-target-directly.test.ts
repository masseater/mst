import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noIdentityWrapper } from "./no-identity-wrapper--use-the-target-directly.ts";

describe("dont-review-it/no-identity-wrapper--use-the-target-directly", () => {
  testLintRule(noIdentityWrapper, {
    valid: [
      {
        name: "a function that does work of its own is not a wrapper",
        code: "const parseUser = (input) => JSON.parse(input).user;\nparseUser(source);",
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
        code: "const parseUser = (input) => {\n  record(input);\n};\nparseUser(source);",
      },
      {
        name: "a rest parameter taken apart by a pattern forwards no name",
        code: "function parseUser(...[input]) {\n  return parse(...[input]);\n}\nparseUser(source);",
      },
      {
        name: "spreading something other than a parameter is not forwarding it",
        code: "function parseUser(input) {\n  return parse(...[input]);\n}\nparseUser(source);",
      },
      {
        name: "a function declared without a body forwards nothing",
        code: "declare function parseUser(input: string): unknown;",
      },
      {
        name: "an anonymous default function has no second name to remove",
        code: "export default function (input) {\n  return parse(input);\n}",
      },
      {
        name: "overload signatures declare a contract that the implementation preserves",
        code: "function parseUser(input: string): User;\nfunction parseUser(input: Uint8Array): User;\nfunction parseUser(input: string | Uint8Array) {\n  return parse(input);\n}\nparseUser(source);",
      },
      {
        name: "exported overload signatures and implementation share their program container",
        code: "export function parseUser(input: string): User;\nexport function parseUser(input: Uint8Array): User;\nexport function parseUser(input: string | Uint8Array) {\n  return parse(input);\n}\nparseUser(source);",
      },
      {
        name: "an exported wrapper has call sites outside the closed local reference set",
        code: "export const parseUser = (input) => parse(input);\nparseUser(source);",
      },
      {
        name: "an exported wrapper around an import may be called with an unknown shape",
        code: "import { parse } from './parse.ts';\nexport const parseUser = (input) => parse(input);\nparseUser(source);",
      },
      {
        name: "a wrapper exported after its declaration has an open reference set",
        code: "const parseUser = (input) => parse(input);\nexport { parseUser };",
      },
      {
        name: "a wrapper passed as a callback may intentionally discard callback metadata",
        code: "const parseOne = (input) => parse(input);\nvalues.map(parseOne);",
      },
      {
        name: "a direct call with extra arguments relies on the wrapper discarding them",
        code: "const parseOne = (input) => parse(input);\nparseOne(source, index);",
      },
      {
        name: "an optional wrapper call does not preserve the target failure semantics",
        code: "const parseOne = (input) => parse(input);\nparseOne?.(source);",
      },
      {
        name: "a direct call with a missing argument relies on the wrapper passing undefined",
        code: "const join = (left, right) => combine(left, right);\njoin(source);",
      },
      {
        name: "a spread call can send a different argument count to the target",
        code: "const parseOne = (input) => parse(input);\nparseOne(...inputs);",
      },
      {
        name: "a call that adds an argument is a partial application and not a pass through",
        code: "const parseUser = (input) => parse(input, DEFAULT_OPTIONS);\nparseUser(source);",
      },
      {
        name: "a call that takes a property off a parameter transforms it",
        code: "const findUser = (record) => find(record.id);\nfindUser(source);",
      },
      {
        name: "a call that reorders the parameters is not a pass through",
        code: "const swap = (left, right) => join(right, left);\nswap(left, right);",
      },
      {
        name: "a call that drops a parameter is not a pass through",
        code: "const parseUser = (input, options) => parse(input);\nparseUser(source, options);",
      },
      {
        name: "a body with a statement beside the call is not a pass through",
        code: "const parseUser = (input) => {\n  record(input);\n  return parse(input);\n};\nparseUser(source);",
      },
      {
        name: "a return type annotation declares a contract at this boundary",
        code: "const parseUser = (input: string): User => parse(input);\nparseUser(source);",
      },
      {
        name: "a type annotation on the binding declares a contract at this boundary",
        code: "const parseUser: ParseUser = (input) => parse(input);\nparseUser(source);",
      },
      {
        name: "a function declaration with a return type annotation declares a contract",
        code: "function parseUser(input: string): User {\n  return parse(input);\n}\nparseUser(source);",
      },
      {
        name: "type parameters of its own make the call site decide the type",
        code: "const parseUser = <Parsed>(input) => parse(input);\nparseUser<User>(source);",
      },
      {
        name: "type arguments on the forwarded call declare the type it produces",
        code: "const parseUser = (input) => parse<User>(input);\nparseUser(source);",
      },
      {
        name: "an async function changes the contract to a promise by construction",
        code: "const parseUser = async (input) => parse(input);\nparseUser(source);",
      },
      {
        name: "a generator changes the contract to a sequence by construction",
        code: "function* parseUser(input) {\n  yield parse(input);\n}\nparseUser(source);",
      },
      {
        name: "calling a parameter is applying what was handed in, not forwarding to a target",
        code: "const runWith = (run, input) => run(input);\nrunWith(run, source);",
      },
      {
        name: "an unused call wrapper is left to the unused declaration authority",
        code: "const parseUser = (input) => parse(input);",
      },
      {
        name: "an unused construction wrapper is left to the unused declaration authority",
        code: "const parseUser = (input) => new Parser(input);",
      },
      {
        name: "calling a member rooted in a parameter is not calling a fixed target",
        code: "const runWith = (service) => service.run(service);\nrunWith(service);",
      },
      {
        name: "calling a nested member rooted in a parameter is not calling a fixed target",
        code: "const runWith = (registry) => registry.services.runner.run(registry);\nrunWith(registry);",
      },
      {
        name: "a computed member selected by a parameter is not a fixed target",
        code: "const dispatch = (key) => handlers[key](key);\ndispatch(key);",
      },
      {
        name: "a target-producing call that consumes a parameter is not fixed",
        code: "const dispatch = (key) => getHandler(key).run(key);\ndispatch(key);",
      },
      {
        name: "a recursive function does not forward to a separate target",
        code: "function recurse(value) {\n  return recurse(value);\n}",
      },
      {
        name: "a named function expression can recurse through its inner binding",
        code: "const recurse = function visit(value) {\n  return visit(value);\n};\nrecurse(source);",
      },
      {
        name: "an instance member depends on the call receiver",
        code: "function dispatch(value) {\n  return this.handle(value);\n}\ndispatch(source);",
      },
      {
        name: "an arrow wrapper that calls a super member depends on its lexical method context",
        code: "class Child extends Parent {\n  dispatch(value) {\n    const handle = (input) => super.handle(input);\n    return handle(value);\n  }\n}",
      },
      {
        name: "an arrow wrapper that constructs a super member depends on its lexical method context",
        code: "class Child extends Parent {\n  create(value) {\n    const construct = (input) => new super.Constructor(input);\n    return construct(value);\n  }\n}",
      },
      {
        name: "a direct super construction is not an eval target",
        code: "class Child extends Parent {\n  constructor(value) {\n    super(value);\n  }\n}",
      },
      {
        name: "a target selected through arguments depends on the wrapper invocation",
        code: "function dispatch(value) {\n  return handlers[arguments.length](value);\n}\ndispatch(source);",
      },
      {
        name: "a target selected through new target depends on construction context",
        code: "function dispatch(value) {\n  return (new.target ? handlers.construct : handlers.call)(value);\n}\ndispatch(source);",
      },
      {
        name: "a target produced by direct eval depends on the wrapper lexical scope",
        code: "function dispatch(value) {\n  return eval('handler')(value);\n}\ndispatch(source);",
      },
      {
        name: "forwarding directly to eval still changes which lexical scope it reads",
        code: "function evaluate(source) {\n  return eval(source);\n}\nevaluate(code);",
      },
      {
        name: "TypeScript wrappers around direct eval disappear before execution",
        code: "function evaluate(source) {\n  return eval!(source);\n}\nevaluate(code);\nfunction evaluateAs(source) {\n  return (eval as typeof eval)(source);\n}\nevaluateAs(code);\nfunction evaluateSatisfies(source) {\n  return (eval satisfies typeof eval)(source);\n}\nevaluateSatisfies(code);\nfunction evaluateAsserted(source) {\n  return (<typeof eval>eval)(source);\n}\nevaluateAsserted(code);",
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
        code: "const parseUser = ({ input }) => parse(input);\nparseUser(source);",
      },
      {
        name: "a defaulted parameter supplies a value the target never sees otherwise",
        code: "const parseUser = (input = EMPTY) => parse(input);\nparseUser(source);",
      },
      {
        name: "an optional call is a different call than the target",
        code: "const parseUser = (input) => parse?.(input);\nparseUser(source);",
      },
      {
        name: "re-exporting the name forwards the definition instead of copying its shape",
        code: "export { parseUser } from './parse-user.ts';",
      },
      {
        name: "a constructor target handed in as a parameter is not a fixed target",
        code: "const construct = (Constructor) => new Constructor(Constructor);\nconstruct(Parser);",
      },
      {
        name: "a constructor target rooted in a parameter is not a fixed target",
        code: "const construct = (constructors) => new constructors.Parser(constructors);\nconstruct(constructors);",
      },
      {
        name: "a nested constructor target rooted in a parameter is not a fixed target",
        code: "const construct = (registry) => new registry.parsers.Parser(registry);\nconstruct(registry);",
      },
      {
        name: "a constructor selected through arguments depends on the wrapper invocation",
        code: "function construct(value) {\n  return new constructors[arguments.length](value);\n}\nconstruct(source);",
      },
      {
        name: "a construction that adds an argument is a partial application",
        code: "const parseUser = (input) => new Parser(input, DEFAULT_OPTIONS);\nparseUser(source);",
      },
      {
        name: "a construction that transforms an argument is not a pass through",
        code: "const parseUser = (record) => new Parser(record.input);\nparseUser(source);",
      },
      {
        name: "type arguments on the construction declare the type it produces",
        code: "const parseUser = (input) => new Parser<User>(input);\nparseUser(source);",
      },
    ],
    invalid: [
      {
        name: "an erased this parameter does not occupy a runtime argument position",
        code: "function parseUser(this: void, input: string) {\n  return parse(input);\n}\nparseUser(source);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "a native coercion wrapper with a closed call uses the target directly",
        code: "const toString = (input) => String(input);\ntoString(source);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "a shadowed coercion target is still an ordinary identity wrapper",
        code: "const String = (input) => parse(input).value;\nconst toString = (input) => String(input);\ntoString(source);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "an arrow that forwards its only parameter is reported",
        code: "const parseUser = (input) => parse(input);\nparseUser(source);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "a zero-argument native call is not the upstream coercion callback shape",
        code: "const emptyString = () => String();\nemptyString();",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "a block body whose only statement returns the forwarded call is reported",
        code: "const parseUser = (input) => {\n  return parse(input);\n};\nparseUser(source);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "a function declaration that forwards its parameters is reported",
        code: "function parseUser(input) {\n  return parse(input);\n}\nparseUser(source);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "a function expression bound to a name is reported",
        code: "const parseUser = function (input) {\n  return parse(input);\n};\nparseUser(source);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "forwarding several parameters in the same order is reported",
        code: "const parseUser = (input, options) => parse(input, options);\nparseUser(source, options);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "forwarding no parameters at all is a second name for the same call",
        code: "const loadUsers = () => fetchUsers();\nloadUsers();",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "spreading a rest parameter into the target forwards every argument",
        code: "const parseUser = (...inputs) => parse(...inputs);\nparseUser(...sources);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "forwarding to a member of another object is still a second name",
        code: "const parseUser = (input) => parser.parse(input);\nparseUser(source);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "parameter type annotations alone declare nothing about what comes back",
        code: "const parseUser = (input: string) => parse(input);\nparseUser(source);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "a shadowed eval binding is a fixed ordinary function target",
        code: "const eval = createEvaluator();\nconst dispatch = (value) => eval('handler')(value);\ndispatch(source);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "import meta is a fixed module context at every local call site",
        code: "const resolve = (path) => import.meta.resolve(path);\nresolve('./feature.ts');",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "this owned by a nested ordinary function is not wrapper execution context",
        code: "const dispatch = (value) => (function () { return this.handler; }).call(registry)(value);\ndispatch(source);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "a target binding shadowed at the call site still leaves an identity wrapper",
        code: "const target = parse;\nconst parseUser = (input) => target(input);\nfunction read(target) {\n  return parseUser(source);\n}",
        errors: [{ message: /Rename every call-site binding.*alpha-renaming/u }],
      },
      {
        name: "an effectful argument before an effectful target still leaves an identity wrapper",
        code: "const parseUser = (input) => getParser().parse(input);\nparseUser(readSource());",
        errors: [{ message: /arguments from left to right into temporary bindings/u }],
      },
      {
        name: "parentheses around the forwarded call do not change the shape",
        code: "const parseUser = (input) => (parse(input));\nparseUser(source);",
        errors: [{ messageId: "identityCall" }],
      },
      {
        name: "each wrapper in a file is reported on its own",
        code: "const parseUser = (input) => parse(input);\nconst formatUser = (user) => format(user);\nparseUser(source);\nformatUser(user);",
        errors: [{ messageId: "identityCall" }, { messageId: "identityCall" }],
      },
      {
        name: "an arrow that constructs a fixed target from its only parameter is reported",
        code: "const parseUser = (input) => new Parser(input);\nparseUser(source);",
        errors: [{ message: /arguments from left to right into temporary bindings/u }],
      },
      {
        name: "a block body whose only statement returns the forwarded construction is reported",
        code: "const parseUser = (input) => {\n  return new Parser(input);\n};\nparseUser(source);",
        errors: [{ messageId: "identityConstruction" }],
      },
      {
        name: "a function declaration that forwards its parameters to a construction is reported",
        code: "function parseUser(input) {\n  return new Parser(input);\n}\nparseUser(source);",
        errors: [{ messageId: "identityConstruction" }],
      },
      {
        name: "forwarding no parameters to a construction adds only a second name",
        code: "const loadParser = () => new Parser();\nloadParser();",
        errors: [{ messageId: "identityConstruction" }],
      },
      {
        name: "spreading a rest parameter into a construction forwards every argument",
        code: "const parseUser = (...inputs) => new Parser(...inputs);\nparseUser(...sources);",
        errors: [{ messageId: "identityConstruction" }],
      },
      {
        name: "constructing a member of a fixed object is still a second name",
        code: "const parseUser = (input) => new parsers.Parser(input);\nparseUser(source);",
        errors: [{ messageId: "identityConstruction" }],
      },
      {
        name: "parameter type annotations alone declare nothing about the constructed value",
        code: "const parseUser = (input: string) => new Parser(input);\nparseUser(source);",
        errors: [{ messageId: "identityConstruction" }],
      },
      {
        name: "a call and a construction use their distinct messages",
        code: "const parseUser = (input) => parse(input);\nconst createUser = (input) => new User(input);\nparseUser(source);\ncreateUser(source);",
        errors: [{ messageId: "identityCall" }, { messageId: "identityConstruction" }],
      },
    ],
  });
});
