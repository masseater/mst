import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noLoggedAndContinuedFailure } from "./no-logged-and-continued-failure--stop-or-recover.ts";

describe("dont-review-it/no-logged-and-continued-failure--stop-or-recover", () => {
  testLintRule(noLoggedAndContinuedFailure, {
    valid: [
      {
        name: "a catch clause that rethrows hands the decision to the caller",
        code: "try {\n  run();\n} catch (failure) {\n  console.error(failure);\n  throw failure;\n}",
      },
      {
        name: "a write to a stream that is not the process output is not an output sink",
        code: "try {\n  run();\n} catch (failure) {\n  socket.stdout.write(failure);\n}",
      },
      {
        name: "a statement in the clause that is not a call is not a stop",
        code: "try {\n  run();\n} catch (failure) {\n  console.error(failure);\n  pending;\n  throw failure;\n}",
      },
      {
        name: "a catch clause that throws a failure naming this layer also stops",
        code: "try {\n  run();\n} catch (failure) {\n  console.error(failure);\n  throw new Error('reading the catalog failed', { cause: failure });\n}",
      },
      {
        name: "a catch clause that returns a substitute recovers",
        code: "const read = () => {\n  try {\n    return run();\n  } catch (failure) {\n    console.error(failure);\n    return null;\n  }\n};",
      },
      {
        name: "a catch clause that writes to a stream and then recovers is complete",
        code: "const read = () => {\n  try {\n    return run();\n  } catch (failure) {\n    process.stderr.write(String(failure));\n    return fallback();\n  }\n};",
      },
      {
        name: "a catch clause that ends the process stops",
        code: "try {\n  run();\n} catch (failure) {\n  process.stderr.write(String(failure));\n  process.exit(1);\n}",
      },
      {
        name: "a catch clause that writes nothing is outside what this rule looks at",
        code: "try {\n  run();\n} catch {\n  recover();\n}",
      },
      {
        name: "writing outside a catch clause is the program's own output",
        code: "console.log('done');",
      },
      {
        name: "writing in the try block is not a report of a caught failure",
        code: "try {\n  console.log('starting');\n  run();\n} catch (failure) {\n  throw failure;\n}",
      },
      {
        name: "writing in the finally block is not a report of a caught failure",
        code: "try {\n  run();\n} catch (failure) {\n  throw failure;\n} finally {\n  console.log('done');\n}",
      },
      {
        name: "a function declared inside the catch clause has its own body",
        code: "try {\n  run();\n} catch (failure) {\n  register(() => {\n    console.error(failure);\n  });\n  throw failure;\n}",
      },
      {
        name: "a write to a stream that is not a process stream is not an output sink",
        code: "try {\n  run();\n} catch (failure) {\n  buffer.write(String(failure));\n}",
      },
    ],
    invalid: [
      {
        name: "a catch clause that writes the failure and carries on is reported",
        code: "try {\n  run();\n} catch (failure) {\n  console.error(failure);\n}",
        errors: [{ messageId: "loggedAndContinuedFailure" }],
      },
      {
        name: "the console method that is called does not change the shape",
        code: "try {\n  run();\n} catch (failure) {\n  console.warn(failure);\n}",
        errors: [{ messageId: "loggedAndContinuedFailure" }],
      },
      {
        name: "writing to the standard error stream is the same shape",
        code: "try {\n  run();\n} catch (failure) {\n  process.stderr.write(String(failure));\n}",
        errors: [{ messageId: "loggedAndContinuedFailure" }],
      },
      {
        name: "writing to the standard output stream is the same shape",
        code: "try {\n  run();\n} catch (failure) {\n  process.stdout.write(String(failure));\n}",
        errors: [{ messageId: "loggedAndContinuedFailure" }],
      },
      {
        name: "a stop that only happens inside a condition leaves the other paths carrying on",
        code: "try {\n  run();\n} catch (failure) {\n  console.error(failure);\n  if (isFatal(failure)) {\n    throw failure;\n  }\n}",
        errors: [{ messageId: "loggedAndContinuedFailure" }],
      },
      {
        name: "a write nested in a condition inside the catch clause is reported",
        code: "try {\n  run();\n} catch (failure) {\n  if (isLoud(failure)) {\n    console.error(failure);\n  }\n}",
        errors: [{ messageId: "loggedAndContinuedFailure" }],
      },
      {
        name: "a write inside a loop in the catch clause is reported",
        code: "try {\n  run();\n} catch (failure) {\n  for (const line of lines(failure)) {\n    console.error(line);\n  }\n}",
        errors: [{ messageId: "loggedAndContinuedFailure" }],
      },
      {
        name: "each write in a catch clause that carries on is reported on its own",
        code: "try {\n  run();\n} catch (failure) {\n  console.error(failure);\n  console.error('continuing');\n}",
        errors: [
          { messageId: "loggedAndContinuedFailure" },
          { messageId: "loggedAndContinuedFailure" },
        ],
      },
      {
        name: "a break does not end the work the way a throw or a return does",
        code: "for (const task of tasks) {\n  try {\n    run(task);\n  } catch (failure) {\n    console.error(failure);\n    break;\n  }\n}",
        errors: [{ messageId: "loggedAndContinuedFailure" }],
      },
      {
        name: "an inner catch clause is judged on its own statements",
        code: "try {\n  run();\n} catch (outer) {\n  try {\n    recover();\n  } catch (inner) {\n    console.error(inner);\n  }\n  throw outer;\n}",
        errors: [{ messageId: "loggedAndContinuedFailure" }],
      },
      {
        name: "a write in a catch clause inside a test file carries no exemption",
        code: "try {\n  run();\n} catch (failure) {\n  console.error(failure);\n}",
        filename: "/repo/packages/repository-checks/src/total.test.ts",
        errors: [{ messageId: "loggedAndContinuedFailure" }],
      },
    ],
  });
});
