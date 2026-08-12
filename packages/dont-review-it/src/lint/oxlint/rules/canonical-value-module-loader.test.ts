import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { STRICT_RULE } from "./canonical-literal-rule-test-fixture.ts";

const repositoryRoot = findWorkspaceRoot(process.cwd());
const consumer = join(repositoryRoot, "packages/dont-review-it/src/lint/oxlint/rules/consumer.ts");
const fixture = "./canonical-literal-owner-exemption.test.ts";
const fixtureUrl = pathToFileURL(
  join(repositoryRoot, "packages/dont-review-it/src/lint/oxlint/rules", fixture),
).href;
const encodedFixtureUrl = fixtureUrl.replace("owner-exemption", "owner%2Dexemption");

const invalid = (name: string, code: string) => ({
  code,
  cwd: repositoryRoot,
  errors: [{ messageId: "productionImportsOutOfScopeSource" as const }],
  filename: consumer,
  name,
});

const valid = (name: string, code: string) => ({
  code,
  cwd: repositoryRoot,
  filename: consumer,
  name,
});

describe("canonical value module loader", () => {
  testLintRule(STRICT_RULE, {
    valid: [
      valid(
        "a local require main object is not a module loader",
        `const require = { main: { require: consume } };\nrequire.main.require("${fixture}");`,
      ),
      valid(
        "a local process main module is not a module loader",
        `const process = { mainModule: { require: consume } };\nprocess.mainModule.require("${fixture}");`,
      ),
      valid(
        "a local module constructor is not a module loader",
        `const module = { constructor: { createRequire: () => consume } };\nmodule.constructor.createRequire(import.meta.url)("${fixture}");`,
      ),
    ],
    invalid: [
      invalid(
        "a module source returned by a called function cannot load a fixture",
        `const source = () => "${fixture}" as const;\nexport const value = require(source());`,
      ),
      invalid(
        "a destructured module require cannot load a fixture",
        `const { require: load } = module;\nexport const value = load("${fixture}");`,
      ),
      invalid(
        "a destructured create require cannot load a fixture",
        `import nodeModule from "node:module";\nconst { createRequire } = nodeModule;\nconst load = createRequire(import.meta.url);\nexport const value = load("${fixture}");`,
      ),
      invalid(
        "a reflected argument array property cannot load a fixture",
        `const args = { values: ["${fixture}"] } as const;\nexport const value = Reflect.apply(require, undefined, args.values);`,
      ),
      invalid("constructing require cannot load a fixture", `new require("${fixture}");`),
      invalid(
        "constructing a require alias cannot load a fixture",
        `const load = require;\nnew load("${fixture}");`,
      ),
      invalid(
        "constructing module require cannot load a fixture",
        `new module.require("${fixture}");`,
      ),
      invalid(
        "Reflect construct cannot load a fixture",
        `Reflect.construct(require, ["${fixture}"]);`,
      ),
      invalid(
        "a Reflect construct alias cannot load a fixture",
        `const construct = Reflect.construct;\nconstruct(require, ["${fixture}"]);`,
      ),
      invalid("a file URL cannot load a fixture", `import("${fixtureUrl}");`),
      invalid(
        "a percent encoded file URL cannot load a fixture",
        `import("${encodedFixtureUrl}");`,
      ),
      invalid(
        "an inline data module cannot supply an unchecked value",
        "import(\"data:text/javascript,export default 'draft'\");",
      ),
      invalid(
        "a base64 data module cannot supply an unchecked value",
        'import("data:text/javascript;base64,ZXhwb3J0IGRlZmF1bHQgJ2RyYWZ0Jw==");',
      ),
      invalid(
        "require resolve cannot conceal a fixture source",
        `require(require.resolve("${fixture}"));`,
      ),
      invalid(
        "a require resolve alias cannot conceal a fixture source",
        `const resolveSource = require.resolve;\nrequire(resolveSource("${fixture}"));`,
      ),
      invalid(
        "a created require resolver cannot conceal a fixture source",
        `import { createRequire } from "node:module";\nconst load = createRequire(import.meta.url);\nload(load.resolve("${fixture}"));`,
      ),
      invalid(
        "import meta resolve cannot conceal a fixture source",
        `import(import.meta.resolve("${fixture}"));`,
      ),
      invalid(
        "a require resolved source binding cannot conceal a fixture",
        `const source = require.resolve("${fixture}");\nrequire(source);`,
      ),
      invalid(
        "an aliased require resolved source binding cannot conceal a fixture",
        `const resolveSource = require.resolve;\nconst source = resolveSource("${fixture}");\nrequire(source);`,
      ),
      invalid(
        "a created require resolved source binding cannot conceal a fixture",
        `import { createRequire } from "node:module";\nconst load = createRequire(import.meta.url);\nconst source = load.resolve("${fixture}");\nload(source);`,
      ),
      invalid(
        "an import meta resolved source binding cannot conceal a fixture",
        `const source = import.meta.resolve("${fixture}");\nimport(source);`,
      ),
      invalid(
        "process builtin module cannot conceal a fixture source",
        `process.getBuiltinModule("node:module").createRequire(import.meta.url)("${fixture}");`,
      ),
      invalid(
        "a destructured process builtin module cannot conceal a fixture source",
        `const { createRequire } = process.getBuiltinModule("node:module");\ncreateRequire(import.meta.url)("${fixture}");`,
      ),
      invalid(
        "a process builtin module alias cannot conceal a fixture source",
        `const loadModule = process.getBuiltinModule;\nloadModule("node:module").createRequire(import.meta.url)("${fixture}");`,
      ),
      invalid(
        "a Vite glob cannot load fixtures",
        `export const modules = import.meta.glob("./canonical-literal-*.test.ts");`,
      ),
      {
        code: `export const modules = import.meta.glob("./canonical-literal-*.test.ts", { eager: true });`,
        cwd: repositoryRoot,
        errors: [
          { messageId: "productionImportsOutOfScopeSource" as const },
          { messageId: "canonicalValueLiteral" as const },
        ],
        filename: consumer,
        name: "an eager Vite glob cannot load fixtures",
      },
      invalid(
        "a Vite glob pattern array cannot load fixtures",
        `export const modules = import.meta.glob(["./canonical-literal-*.test.ts"]);`,
      ),
      invalid(
        "a Vite glob alias cannot load fixtures",
        `const glob = import.meta.glob;\nexport const modules = glob("./canonical-literal-*.test.ts");`,
      ),
      invalid(
        "a known Vite glob cannot be hidden by an unknown pattern",
        `declare const pattern: string;\nexport const modules = import.meta.glob([pattern, "./canonical-literal-*.test.ts"]);`,
      ),
      invalid(
        "a Vite glob call alias cannot load fixtures",
        `const glob = import.meta.glob.call;\nexport const modules = glob(import.meta, "./canonical-literal-*.test.ts");`,
      ),
      invalid("require main cannot load a fixture", `require.main.require("${fixture}");`),
      invalid(
        "process main module cannot load a fixture",
        `process.mainModule.require("${fixture}");`,
      ),
      invalid(
        "the CommonJS module constructor cannot load a fixture",
        `module.constructor.createRequire(__filename)("${fixture}");`,
      ),
    ],
  });
});
