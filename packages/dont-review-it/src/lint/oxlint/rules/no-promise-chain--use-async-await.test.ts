import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noPromiseChain } from "./no-promise-chain--use-async-await.ts";

describe("dont-review-it/no-promise-chain--use-async-await", () => {
  testLintRule(noPromiseChain, {
    valid: [
      {
        name: "awaiting the value and handling failure in an enclosing try statement is the shape this rule keeps",
        code: "const load = async (fetchUser, release) => {\n  try {\n    const user = await fetchUser();\n    return user;\n  } catch (failure) {\n    throw failure;\n  } finally {\n    release();\n  }\n};",
      },
      {
        name: "composing with a static Promise method is a member call whose name is none of the three",
        code: "const both = async (first, second) => await Promise.all([first, second]);",
      },
      {
        name: "constructing a promise is not a member call",
        code: "const pending = new Promise((resolve, reject) => resolve(reject));",
      },
      {
        name: "a member whose name merely contains one of the three words is not an exact match",
        code: "queue.thenable(handle);\nqueue.catchAll(handle);\nqueue.finallyRun(handle);",
      },
      {
        name: "a computed call through a variable key does not resolve to a static property name",
        code: "queue[key](handle);",
      },
      {
        name: "a computed call through a numeric literal is not a string property name",
        code: "handlers[0](handle);",
      },
      {
        name: "a computed call through a template with a substitution does not resolve statically",
        code: "queue[`th${suffix}`](handle);",
      },
      {
        name: "a computed call through a string key that is none of the three words is not reported",
        code: "queue['done'](handle);",
      },
      {
        name: "taking the member as a value without calling it is not a call position",
        code: "const continueWith = promise.then;",
      },
      {
        name: "defining a method named then is not a call position",
        code: "const box = {\n  then(handle) {\n    return handle;\n  },\n};",
      },
      {
        name: "a private field call resolves to a name that is not then",
        code: "class Loader {\n  #then() {\n    return 1;\n  }\n\n  run() {\n    return this.#then();\n  }\n}",
      },
      {
        name: "the try statement's own catch and finally are syntax, not member references",
        code: "const run = (close) => {\n  try {\n    return 1;\n  } catch (failure) {\n    return failure;\n  } finally {\n    close();\n  }\n};",
      },
      {
        name: "a plain call is not a member call",
        code: "handle(promise);",
      },
    ],
    invalid: [
      {
        name: "a then call is reported at the property name",
        code: "promise.then(handle);",
        errors: [{ messageId: "promiseChainCall" }],
      },
      {
        name: "a catch call is reported at the property name",
        code: "promise.catch(recover);",
        errors: [{ messageId: "promiseChainCall" }],
      },
      {
        name: "a finally call is reported at the property name",
        code: "promise.finally(close);",
        errors: [{ messageId: "promiseChainCall" }],
      },
      {
        name: "a computed call through a string literal resolves to the same name",
        code: "promise['then'](handle);",
        errors: [{ messageId: "promiseChainCall" }],
      },
      {
        name: "a computed call through a template without substitutions resolves to the same name",
        code: "promise[`then`](handle);",
        errors: [{ messageId: "promiseChainCall" }],
      },
      {
        name: "an optionally chained member call has the same shape",
        code: "promise?.then(handle);",
        errors: [{ messageId: "promiseChainCall" }],
      },
      {
        name: "an optionally invoked member call has the same shape",
        code: "promise.then?.(handle);",
        errors: [{ messageId: "promiseChainCall" }],
      },
      {
        name: "a non-null assertion on the receiver leaves the member call in place",
        code: "promise!.then(handle);",
        errors: [{ messageId: "promiseChainCall" }],
      },
      {
        name: "each link of a chain is reported on its own",
        code: "promise.then(handle).catch(recover).finally(close);",
        errors: [
          { messageId: "promiseChainCall" },
          { messageId: "promiseChainCall" },
          { messageId: "promiseChainCall" },
        ],
      },
      {
        name: "a call inside a function that cannot await is still reported",
        code: "const run = (fetchUser, handle) => {\n  fetchUser().then(handle);\n};",
        errors: [{ messageId: "promiseChainCall" }],
      },
      {
        name: "a receiver that is not a promise is reported because the name is all this rule reads",
        code: "queryBuilder.finally(cleanup);",
        errors: [{ messageId: "promiseChainCall" }],
      },
      {
        name: "wrapping the callee in parentheses leaves the member call in place",
        code: "(promise.then)(handle);",
        errors: [{ messageId: "promiseChainCall" }],
      },
    ],
  });
});
