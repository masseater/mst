import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noFloatingPromise } from "./no-floating-promise--await-the-result.ts";

const ASSERTED_WIDENING = ["as", "any"].join(" ");

const ANNOTATED_WIDENING = [":", "any"].join(" ");

describe("dont-review-it/no-floating-promise--await-the-result", () => {
  testLintRule(noFloatingPromise, {
    valid: [
      {
        name: "awaiting the call connects it to the enclosing control flow",
        code: "const fetchUser = async () => 1;\nconst load = async () => {\n  await fetchUser();\n};",
      },
      {
        name: "returning the call hands the connection to the caller",
        code: "const fetchUser = async () => 1;\nconst load = () => {\n  return fetchUser();\n};",
      },
      {
        name: "an arrow that returns the call without a block hands the connection to the caller",
        code: "const fetchUser = async () => 1;\nconst load = () => fetchUser();",
      },
      {
        name: "binding the promise and awaiting the binding connects it",
        code: "const fetchUser = async () => 1;\nconst load = async () => {\n  const pending = fetchUser();\n  await pending;\n};",
      },
      {
        name: "handing the calls to a composition and awaiting the composition connects them",
        code: "const fetchUser = async () => 1;\nconst load = async () => {\n  await Promise.all([fetchUser(), fetchUser()]);\n};",
      },
      {
        name: "a synchronous call yields no promise",
        code: "const readUser = () => 1;\nreadUser();",
      },
      {
        name: "a call through a name this file does not declare leaves the declaration unread",
        code: "unknownCall();",
      },
      {
        name: "a call through an imported name leaves the declaration unread",
        code: "import { fetchUser } from './users.ts';\n\nfetchUser();",
      },
      {
        name: "operating on the awaited value operates on a value that is already connected",
        code: "const fetchUser = async () => ({ id: 1 });\nconst load = async () => {\n  const user = await fetchUser();\n  recordUser(user);\n};",
      },
      {
        name: "declaring an asynchronous function is not a call position",
        code: "async function loadUser() {\n  return 1;\n}",
      },
      {
        name: "voiding a synchronous call leaves no promise to connect",
        code: "const readUser = () => 1;\nvoid readUser();",
      },
      {
        name: "voiding an awaited value leaves no promise to connect",
        code: "const fetchUser = async () => 1;\nconst load = async () => {\n  void (await fetchUser());\n};",
      },
      {
        name: "a callback handed to a parameter that declares a promise return is awaited by the receiver",
        code: "const runEach = (visit: (name: string) => Promise<void>) => {\n  register(visit);\n};\nrunEach(async (name: string) => {\n  await save(name);\n});",
      },
      {
        name: "a synchronous callback handed to a parameter that declares a synchronous return yields no promise",
        code: "const runEach = (visit: (name: string) => void) => {\n  visit('a');\n};\nrunEach((name: string) => {\n  record(name);\n});",
      },
      {
        name: "a parameter without a declared type leaves the callback position unread",
        code: "const runEach = (visit) => {\n  visit('a');\n};\nrunEach(async (name) => {\n  await save(name);\n});",
      },
      {
        name: "a parameter whose declared type is not a function type is not a callback position",
        code: "const runEach = (visit: string) => {\n  record(visit);\n};\nrunEach(handler);",
      },
      {
        name: "a parameter that declares an unknown return does not declare a synchronous one",
        code: "const runEach = (visit: (name: string) => unknown) => {\n  visit('a');\n};\nrunEach(async (name: string) => {\n  await save(name);\n});",
      },
      {
        name: "a rest parameter does not fix which declared position an argument lands in",
        code: "const runEach = (...visits: ((name: string) => void)[]) => {\n  record(visits);\n};\nrunEach(async (name: string) => {\n  await save(name);\n});",
      },
      {
        name: "spreading the arguments does not fix which declared position each one lands in",
        code: "const runEach = (visit: (name: string) => void) => {\n  visit('a');\n};\nrunEach(...handlers);",
      },
      {
        name: "an argument past the declared parameters lands in no declared position",
        code: "const runEach = (visit: (name: string) => void) => {\n  visit('a');\n};\nrunEach(record, async () => {\n  await save('a');\n});",
      },
      {
        name: "a widened binding that resolves to a synchronous function yields no promise",
        code: `const readUser = () => 1;\nconst erased${ANNOTATED_WIDENING} = readUser;\nerased();`,
      },
      {
        name: "a member call on a receiver that is not the promise global is a composition this rule does not read",
        code: "queue.all([first, second]);",
      },
      {
        name: "a computed member call on the promise global does not resolve to a static name",
        code: "Promise[key]([first, second]);",
      },
      {
        name: "a member call whose name is none of the promise-producing statics is not a composition",
        code: "queue.forEach(handler);",
      },
      {
        name: "a private member call resolves to a name the promise global cannot carry",
        code: "class Loader {\n  #all() {\n    return 1;\n  }\n\n  run() {\n    this.#all();\n  }\n}",
      },
      {
        name: "a name bound by the runtime rather than by a declaration is not a call this rule can read",
        code: "function run() {\n  arguments();\n}",
      },
      {
        name: "constructing something other than a promise yields no promise",
        code: "new Loader(source);",
      },
      {
        name: "a binding that names itself stops the declaration walk without an answer",
        code: "const spin = spin;\nspin();",
      },
      {
        name: "a binding whose declared type is not a function type is not a promise-yielding callee",
        code: "declare const pending: string;\npending();",
      },
    ],
    invalid: [
      {
        name: "a call to an async arrow standing alone as a statement is reported",
        code: "const fetchUser = async () => 1;\nfetchUser();",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "a call to an async function declaration standing alone as a statement is reported",
        code: "async function fetchUser() {\n  return 1;\n}\nfetchUser();",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "a call to a parameter whose declared type returns a promise is reported",
        code: "const load = (fetchUser: () => Promise<number>) => {\n  fetchUser();\n};",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "a call to a declared function whose return type is a promise is reported",
        code: "declare function fetchUser(): Promise<number>;\nfetchUser();",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "a call whose declared return type is a union carrying a promise is reported",
        code: "declare function fetchUser(): number | Promise<number>;\nfetchUser();",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "a call to a binding annotated with a promise-returning function type is reported",
        code: "const fetchUser: () => Promise<number> = load;\nfetchUser();",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "a call to a binding annotated with a parenthesised promise-returning function type is reported",
        code: "const fetchUser: (() => Promise<number>) = load;\nfetchUser();",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "a call reached through an instantiation expression is still a call to the async declaration",
        code: "const fetchUser = async <Held>(held: Held) => held;\nconst load = fetchUser<string>;\nload('a');",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "a call to a declaration that names PromiseLike is reported",
        code: "declare function fetchUser(): PromiseLike<number>;\nfetchUser();",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "a composition standing alone as a statement is itself unconnected",
        code: "Promise.all([first, second]);",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "constructing a promise as a statement leaves it unconnected",
        code: "new Promise((resolve) => resolve(1));",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "an optionally invoked call leaves the statement in place",
        code: "const fetchUser = async () => 1;\nfetchUser?.();",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "a non-null assertion on the callee leaves the statement in place",
        code: "const fetchUser = async () => 1;\nfetchUser!();",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "asserting the callee to a named type does not detach it from its async declaration",
        code: "const fetchUser = async () => 1;\n(fetchUser as Loader)();",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "a call reached through a second binding is still a call to the async declaration",
        code: "const fetchUser = async () => 1;\nconst load = fetchUser;\nload();",
        errors: [{ messageId: "floatingPromiseStatement" }],
      },
      {
        name: "each unconnected statement in a body is reported on its own",
        code: "const fetchUser = async () => 1;\nconst load = () => {\n  fetchUser();\n  fetchUser();\n};",
        errors: [
          { messageId: "floatingPromiseStatement" },
          { messageId: "floatingPromiseStatement" },
        ],
      },
      {
        name: "voiding the call states an intent instead of connecting the promise",
        code: "const fetchUser = async () => 1;\nvoid fetchUser();",
        errors: [{ messageId: "voidedPromise" }],
      },
      {
        name: "voiding a binding whose declared type is a promise states the same intent",
        code: "declare const pending: Promise<number>;\nvoid pending;",
        errors: [{ messageId: "voidedPromise" }],
      },
      {
        name: "voiding a binding annotated with a parenthesised promise type states the same intent",
        code: "declare const pending: (Promise<number>);\nvoid pending;",
        errors: [{ messageId: "voidedPromise" }],
      },
      {
        name: "voiding a binding whose initialiser is an unconnected call states the same intent",
        code: "const fetchUser = async () => 1;\nconst pending = fetchUser();\nvoid pending;",
        errors: [{ messageId: "voidedPromise" }],
      },
      {
        name: "voiding a composition states the same intent",
        code: "void Promise.all([first, second]);",
        errors: [{ messageId: "voidedPromise" }],
      },
      {
        name: "asserting the callee to a widened type hides the declared type but not the async declaration",
        code: `const fetchUser = async () => 1;\n(fetchUser ${ASSERTED_WIDENING})();`,
        errors: [{ messageId: "widenedAsyncCall" }],
      },
      {
        name: "a widened binding that resolves to an async declaration is reported at the widened call",
        code: `const fetchUser = async () => 1;\nconst erased${ANNOTATED_WIDENING} = fetchUser;\nerased();`,
        errors: [{ messageId: "widenedAsyncCall" }],
      },
      {
        name: "a binding declared unknown that resolves to a promise-returning declaration is reported at the widened call",
        code: "declare function fetchUser(): Promise<number>;\nconst erased: unknown = fetchUser;\nerased();",
        errors: [{ messageId: "widenedAsyncCall" }],
      },
      {
        name: "an async arrow handed to a parameter that declares a synchronous return is reported at the argument",
        code: "const runEach = (visit: (name: string) => void) => {\n  visit('a');\n};\nrunEach(async (name: string) => {\n  await save(name);\n});",
        errors: [{ messageId: "floatingPromiseCallback" }],
      },
      {
        name: "a named async function handed to a synchronous callback position is reported at the argument",
        code: "const saveUser = async (name: string) => {\n  await save(name);\n};\nconst runEach = (visit: (name: string) => void) => {\n  visit('a');\n};\nrunEach(saveUser);",
        errors: [{ messageId: "floatingPromiseCallback" }],
      },
      {
        name: "a callback whose declared type returns a promise is dropped by a synchronous parameter",
        code: "declare const saveUser: (name: string) => Promise<void>;\nconst runEach = (visit: (name: string) => void) => {\n  visit('a');\n};\nrunEach(saveUser);",
        errors: [{ messageId: "floatingPromiseCallback" }],
      },
      {
        name: "a callback handed to a parameter declared through a function-typed binding is reported",
        code: "const runEach: (visit: (name: string) => void) => void = register;\nrunEach(async (name: string) => {\n  await save(name);\n});",
        errors: [{ messageId: "floatingPromiseCallback" }],
      },
    ],
  });
});
