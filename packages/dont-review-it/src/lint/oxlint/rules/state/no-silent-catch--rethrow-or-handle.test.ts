import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noSilentCatch } from "./no-silent-catch--rethrow-or-handle.ts";

describe("dont-review-it/no-silent-catch--rethrow-or-handle", () => {
  testLintRule(noSilentCatch, {
    valid: [
      {
        name: "a catch clause that rethrows hands the failure to the caller",
        documented: true,
        code: "try {\n  run();\n} catch (failure) {\n  release();\n  throw failure;\n}",
      },
      {
        name: "a catch clause that throws a failure holding the original carries it on",
        code: "try {\n  run();\n} catch (failure) {\n  throw new Error('reading the catalog failed', { cause: failure });\n}",
      },
      {
        name: "a catch clause that hands the failure to a call carries it there",
        code: "try {\n  run();\n} catch (failure) {\n  report(failure);\n}",
      },
      {
        name: "a catch clause that returns a value holding the failure carries it to the caller",
        code: "const read = (path) => {\n  try {\n    return run(path);\n  } catch (failure) {\n    return { unreadable: path, cause: failure };\n  }\n};",
      },
      {
        name: "a failure kept in a declared value is carried into that value",
        code: "try {\n  run();\n} catch (failure) {\n  const unreadable = { at: 'catalog', cause: failure };\n  queue(unreadable);\n}",
      },
      {
        name: "a failure read in a condition and rethrown afterwards is still carried",
        documented: true,
        code: "try {\n  run();\n} catch (failure) {\n  if (isTransient(failure)) {\n    retry();\n  }\n  throw failure;\n}",
      },
      {
        name: "a failure handed to a function declared in the clause is carried into it",
        code: "try {\n  run();\n} catch (failure) {\n  register(() => report(failure));\n}",
      },
      {
        name: "a destructured binding that is handed on carries what it bound",
        code: "try {\n  run();\n} catch ({ message }) {\n  report(message);\n}",
      },
      {
        name: "a failure written to an output stream is carried to that stream",
        code: "try {\n  run();\n} catch (failure) {\n  console.error(failure);\n}",
      },
      {
        name: "a catch clause carrying no statement is outside what this rule looks at",
        code: "try {\n  run();\n} catch (failure) {}",
      },
      {
        name: "a catch clause that binds nothing is outside what this rule looks at",
        code: "try {\n  run();\n} catch {\n  retry();\n}",
      },
      {
        name: "an inner catch clause that carries its own failure passes on its own statements",
        code: "try {\n  run();\n} catch (outer) {\n  try {\n    recover();\n  } catch (inner) {\n    report(inner);\n  }\n  throw outer;\n}",
      },
      {
        name: "a failure named outside a catch clause is not this rule's subject",
        code: "const failure = new Error('reading the catalog failed');\nreport(failure);",
      },
      {
        name: "a body holding only a semicolon belongs to no-empty-catch--throw-or-handle",
        code: "try {\n  run();\n} catch (failure) {\n  ;\n}",
      },
      {
        name: "a body holding only an empty block belongs to no-empty-catch--throw-or-handle",
        code: "try {\n  run();\n} catch (failure) {\n  {\n  }\n}",
      },
    ],
    invalid: [
      {
        name: "a catch clause that never names the failure again is reported",
        documented: true,
        code: "try {\n  run();\n} catch (failure) {\n  retry();\n}",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a failure read only in the condition of an if is not carried anywhere",
        documented: true,
        code: "try {\n  run();\n} catch (failure) {\n  if (isTransient(failure)) {\n    retry();\n  }\n}",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a failure read only in the condition of a while is not carried anywhere",
        code: "try {\n  run();\n} catch (failure) {\n  while (isTransient(failure)) {\n    retry();\n  }\n}",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a failure read only in the condition of a do while is not carried anywhere",
        code: "try {\n  run();\n} catch (failure) {\n  do {\n    retry();\n  } while (isTransient(failure));\n}",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a failure read only in the condition of a for is not carried anywhere",
        code: "try {\n  run();\n} catch (failure) {\n  for (; isTransient(failure); ) {\n    retry();\n  }\n}",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a failure read only in the condition of a ternary is not carried anywhere",
        code: "const read = (path) => {\n  try {\n    return run(path);\n  } catch (failure) {\n    return isTransient(failure) ? null : undefined;\n  }\n};",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a failure read only in the subject of a switch is not carried anywhere",
        code: "const read = (path) => {\n  try {\n    return run(path);\n  } catch (failure) {\n    switch (codeOf(failure)) {\n      case 'ENOENT':\n        return null;\n      default:\n        return undefined;\n    }\n  }\n};",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a binding that is only overwritten carries nothing",
        code: "try {\n  run();\n} catch (failure) {\n  failure = null;\n  retry();\n}",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a catch clause that returns a substitute without the failure is reported",
        code: "const read = (path) => {\n  try {\n    return run(path);\n  } catch (failure) {\n    return null;\n  }\n};",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a catch clause that throws a new failure without the original is reported",
        code: "try {\n  run();\n} catch (failure) {\n  throw new Error('reading the catalog failed');\n}",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a value made inside the clause carries nothing of the failure",
        code: "try {\n  run();\n} catch (failure) {\n  const attempted = { at: 'catalog' };\n  report(attempted);\n}",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a same name binding made inside the clause is not the caught failure",
        code: "try {\n  run();\n} catch (failure) {\n  const note = (failure) => report(failure);\n  note(attempted);\n}",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a destructured binding that is never read is reported",
        code: "try {\n  run();\n} catch ({ message }) {\n  retry();\n}",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "an inner catch clause is judged on its own statements",
        code: "try {\n  run();\n} catch (outer) {\n  try {\n    recover();\n  } catch (inner) {\n    retry();\n  }\n  throw outer;\n}",
        errors: [{ messageId: "silentCatch" }],
      },
      {
        name: "a silent catch clause in a test file carries no exemption",
        code: "try {\n  run();\n} catch (failure) {\n  retry();\n}",
        filename: "/repo/packages/utils/src/total.test.ts",
        errors: [{ messageId: "silentCatch" }],
      },
    ],
  });
});
