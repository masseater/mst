import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noDiscardedFailure } from "./no-discarded-failure--receive-and-surface-it.ts";

describe("dont-review-it/no-discarded-failure--receive-and-surface-it", () => {
  testLintRule(noDiscardedFailure, {
    valid: [
      {
        name: "binding both halves of the pair receives the failure",
        documented: true,
        code: "const [failure, parsed] = attempt(() => parse(text));",
      },
      {
        name: "gathering the rest of the pair keeps the failure within reach",
        code: "const { ...both } = attempt(() => parse(text));",
      },
      {
        name: "a binding reached through a computed name cannot be read as the result alone",
        code: "const { [half]: taken } = attempt(() => parse(text));",
      },
      {
        name: "an operator other than void keeps the pair as a value",
        code: "const negated = -attempt(() => parse(text));",
      },
      {
        name: "binding the failure alone receives it",
        code: "const [failure] = attempt(() => parse(text));",
      },
      {
        name: "reading the failure element by index receives it",
        code: "const failure = attempt(() => parse(text))[0];",
      },
      {
        name: "binding the pair itself keeps the failure reachable",
        code: "const parsed = attempt(() => parse(text));",
      },
      {
        name: "a rest element at the head of the pattern binds the failure",
        code: "const [...both] = attempt(() => parse(text));",
      },
      {
        name: "an object pattern that spells the failure index receives it",
        code: "const { 0: failure, 1: parsed } = attempt(() => parse(text));",
      },
      {
        name: "handing the pair to another call passes the failure along",
        code: "report(attempt(() => parse(text)));",
      },
      {
        name: "returning the pair passes the failure to the caller",
        code: "const read = () => {\n  return attempt(() => parse(text));\n};",
      },
      {
        name: "an awaited pair with both halves bound receives the failure",
        code: "const load = async () => {\n  const [failure, parsed] = await attemptAsync(() => parse(text));\n  return failure ?? parsed;\n};",
      },
      {
        name: "an assertion around the pair does not change what is bound",
        code: "const [failure, parsed] = attempt(() => parse(text)) as ParseOutcome;",
      },
      {
        name: "dropping the head of a pair that no failure travels in is another concern",
        code: "const [, second] = declarationsIn(source);",
      },
      {
        name: "dropping the key of an entry pair is another concern",
        code: "const names = Object.entries(fields).flatMap(([, field]) => field.names);",
      },
      {
        name: "a catch clause that names the failure and rethrows it receives it",
        documented: true,
        code: "try {\n  run();\n} catch (failure) {\n  throw failure;\n}",
      },
      {
        name: "a catch clause that destructures the failure names it",
        code: "try {\n  run();\n} catch ({ code }) {\n  throw new Error(code);\n}",
      },
      {
        name: "a member call that is not the pair spelling is outside this rule",
        code: "const parsed = outcome.attempt(() => parse(text))[1];",
      },
    ],
    invalid: [
      {
        name: "eliding the failure element is reported",
        documented: true,
        code: "const [, parsed] = attempt(() => parse(text));",
        errors: [{ messageId: "discardedFailurePair" }],
      },
      {
        name: "reading only the result element by index is reported",
        code: "const parsed = attempt(() => parse(text))[1];",
        errors: [{ messageId: "discardedFailurePair" }],
      },
      {
        name: "parentheses around the pair do not change what is read",
        code: "const parsed = (attempt(() => parse(text)))[1];",
        errors: [{ messageId: "discardedFailurePair" }],
      },
      {
        name: "comparing only the result element still drops the failure",
        code: "const readable = attempt(() => statSync(path).isFile())[1] === true;",
        errors: [{ messageId: "discardedFailurePair" }],
      },
      {
        name: "substituting a value for the dropped result still drops the failure",
        code: "const entries = attempt(() => readdirSync(directory))[1] ?? [];",
        errors: [{ messageId: "discardedFailurePair" }],
      },
      {
        name: "binding the failure to underscores declares it will not be read",
        code: "const [_, parsed] = attempt(() => parse(text));",
        errors: [{ messageId: "discardedFailurePair" }],
      },
      {
        name: "an empty pattern binds neither half",
        code: "const [] = attempt(() => parse(text));",
        errors: [{ messageId: "discardedFailurePair" }],
      },
      {
        name: "an object pattern that spells only the result index drops the failure",
        code: "const { 1: parsed } = attempt(() => parse(text));",
        errors: [{ messageId: "discardedFailurePair" }],
      },
      {
        name: "calling for the effect alone drops the whole pair",
        code: "attempt(() => parse(text));",
        errors: [{ messageId: "discardedFailurePair" }],
      },
      {
        name: "voiding the pair drops both halves",
        code: "void attempt(() => parse(text));",
        errors: [{ messageId: "discardedFailurePair" }],
      },
      {
        name: "eliding the failure of an awaited pair is reported",
        code: "const load = async () => {\n  const [, parsed] = await attemptAsync(() => parse(text));\n  return parsed;\n};",
        errors: [{ messageId: "discardedFailurePair" }],
      },
      {
        name: "each dropped pair in a file is reported on its own",
        code: "const [, first] = attempt(() => parse(one));\nconst [, second] = attempt(() => parse(two));",
        errors: [{ messageId: "discardedFailurePair" }, { messageId: "discardedFailurePair" }],
      },
      {
        name: "a dropped pair in a test file carries no exemption",
        code: "const [, parsed] = attempt(() => parse(text));",
        filename: "/repo/packages/repository-checks/src/parse.test.ts",
        errors: [{ messageId: "discardedFailurePair" }],
      },
      {
        name: "a catch clause that binds nothing is reported",
        documented: true,
        code: "try {\n  run();\n} catch {\n  recover();\n}",
        errors: [{ messageId: "unnamedCatchFailure" }],
      },
      {
        name: "a catch clause that returns a substitute without naming the failure is reported",
        code: "const read = () => {\n  try {\n    return parse(text);\n  } catch {\n    return null;\n  }\n};",
        errors: [{ messageId: "unnamedCatchFailure" }],
      },
      {
        name: "a catch parameter spelled with underscores alone is reported",
        code: "try {\n  run();\n} catch (_) {\n  recover();\n}",
        errors: [{ messageId: "unnamedCatchFailure" }],
      },
      {
        name: "an inner catch clause that binds nothing is reported on its own",
        code: "try {\n  run();\n} catch (failure) {\n  try {\n    recover();\n  } catch {\n    give();\n  }\n  throw failure;\n}",
        errors: [{ messageId: "unnamedCatchFailure" }],
      },
      {
        name: "a catch clause that binds nothing in a test file carries no exemption",
        code: "try {\n  run();\n} catch {\n  recover();\n}",
        filename: "/repo/packages/repository-checks/src/parse.test.ts",
        errors: [{ messageId: "unnamedCatchFailure" }],
      },
    ],
  });
});
