import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noEmptyCatch } from "./no-empty-catch--throw-or-handle.ts";

describe("dont-review-it/no-empty-catch--throw-or-handle", () => {
  testLintRule(noEmptyCatch, {
    valid: [
      {
        name: "a catch clause that rethrows carries a statement",
        code: "try {\n  run();\n} catch (failure) {\n  throw failure;\n}",
        documented: true,
      },
      {
        name: "a catch clause that returns a substitute carries a statement",
        code: "const read = () => {\n  try {\n    return run();\n  } catch (failure) {\n    return null;\n  }\n};",
        documented: true,
      },
      {
        name: "a catch clause that evaluates the failure to nothing still carries a statement",
        code: "try {\n  run();\n} catch (failure) {\n  void failure;\n}",
      },
      {
        name: "a block inside the clause that carries a statement fills the body",
        code: "try {\n  run();\n} catch (failure) {\n  {\n    throw failure;\n  }\n}",
      },
      {
        name: "an empty statement beside a statement leaves the body carrying work",
        code: "try {\n  run();\n} catch (failure) {\n  ;\n  throw failure;\n}",
      },
      {
        name: "a callback declared with an empty body is a statement of its own",
        code: "try {\n  run();\n} catch (failure) {\n  register(() => {});\n}",
      },
      {
        name: "an empty try block is not a catch clause",
        code: "try {\n} catch (failure) {\n  throw failure;\n}",
      },
      {
        name: "an empty finally block is not a catch clause",
        code: "try {\n  run();\n} catch (failure) {\n  throw failure;\n} finally {\n}",
      },
      {
        name: "a block statement outside a try is outside what this rule looks at",
        code: "{\n}",
      },
      {
        name: "an inner catch clause that carries a statement leaves the outer one judged on its own",
        code: "try {\n  run();\n} catch (outer) {\n  try {\n    recover();\n  } catch (inner) {\n    throw inner;\n  }\n}",
      },
    ],
    invalid: [
      {
        name: "a catch clause with an empty body is reported",
        code: "try {\n  run();\n} catch (failure) {\n}",
        errors: [{ messageId: "emptyCatch" }],
        documented: true,
      },
      {
        name: "leaving the failure unbound does not change the shape",
        code: "try {\n  run();\n} catch {\n}",
        errors: [{ messageId: "emptyCatch" }],
      },
      {
        name: "a body holding only a comment carries no statement",
        code: "try {\n  run();\n} catch (failure) {\n  // the catalog is optional here\n}",
        errors: [{ messageId: "emptyCatch" }],
        documented: true,
      },
      {
        name: "a body holding only a block comment carries no statement",
        code: "try {\n  run();\n} catch (failure) {\n  /* the catalog is optional here */\n}",
        errors: [{ messageId: "emptyCatch" }],
      },
      {
        name: "a body holding only an empty statement is reported",
        code: "try {\n  run();\n} catch (failure) {\n  ;\n}",
        errors: [{ messageId: "emptyCatch" }],
      },
      {
        name: "a body holding only an empty block is reported",
        code: "try {\n  run();\n} catch (failure) {\n  {\n  }\n}",
        errors: [{ messageId: "emptyCatch" }],
      },
      {
        name: "nesting empty blocks and empty statements does not fill the body",
        code: "try {\n  run();\n} catch (failure) {\n  {\n    ;\n    {\n    }\n  }\n}",
        errors: [{ messageId: "emptyCatch" }],
      },
      {
        name: "an inner catch clause is judged on its own body",
        code: "try {\n  run();\n} catch (outer) {\n  try {\n    recover();\n  } catch (inner) {\n  }\n  throw outer;\n}",
        errors: [{ messageId: "emptyCatch" }],
      },
      {
        name: "each empty catch clause in a file is reported on its own",
        code: "try {\n  run();\n} catch (first) {\n}\ntry {\n  retry();\n} catch (second) {\n}",
        errors: [{ messageId: "emptyCatch" }, { messageId: "emptyCatch" }],
      },
      {
        name: "an empty catch clause inside a test file carries no exemption",
        code: "try {\n  run();\n} catch (failure) {\n}",
        filename: "/repo/packages/utils/src/total.test.ts",
        errors: [{ messageId: "emptyCatch" }],
      },
    ],
  });
});
