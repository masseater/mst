import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidUnresolvableModuleSpecifier } from "./forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier.ts";

const GROUNDED_EXCEPTION = {
  exceptions: [{ path: "**/plugin-host/**", reason: "the candidates are named by the deployment" }],
};

const GROUNDLESS_EXCEPTION = {
  exceptions: [{ path: "**/plugin-host/**", reason: "" }],
};

const HOST_FILE = "/repo/apps/plugin-host/loader.ts";

describe("dont-review-it/forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier", () => {
  testLintRule(forbidUnresolvableModuleSpecifier, {
    valid: [
      {
        name: "a specifier written out as a string is one string at rest",
        code: 'export const loaded = import("./reader.ts");',
      },
      {
        name: "a synchronous request written out as a string is one string at rest",
        code: 'export const loaded = require("./reader.ts");',
      },
      {
        name: "a template with nothing substituted into it is one string at rest",
        code: "export const loaded = import(`./reader.ts`);",
      },
      {
        name: "a template filled from a constant of this file folds to one string",
        documented: true,
        code: 'const STEM = "reader";\nexport const loaded = import(`./${STEM}.ts`);',
      },
      {
        name: "two written-out strings joined together fold to one string",
        code: 'export const loaded = import("./reader" + ".ts");',
      },
      {
        name: "a constant joined from a constant declared above it folds to one string",
        code: 'const BASE = "./reader";\nconst ENTRY = BASE + ".ts";\nexport const loaded = import(ENTRY);',
      },
      {
        name: "candidates written as a literal in each branch are each one string at rest",
        documented: true,
        code: 'export const load = async (wide: boolean) =>\n  wide ? await import("./wide.ts") : await import("./narrow.ts");',
      },
      {
        name: "a location built from this module's own address resolves before the run",
        code: 'export const loaded = import(new URL("./worker.ts", import.meta.url).href);',
      },
      {
        name: "a resolution asked of this module's own address resolves before the run",
        code: 'export const loaded = import(import.meta.resolve("./worker.ts"));',
      },
      {
        name: "a form the configuration registers resolves before the run",
        code: 'export const loaded = import(resolveEntry("./worker.ts"));',
        options: [{ staticallyResolvedForms: ["resolveEntry"] }],
      },
      {
        name: "a call that requests no module carries no specifier to read",
        code: "export const loaded = load(chosen);",
      },
      {
        name: "a request made through a member of an object is no module request",
        code: "export const loaded = loader.require(chosen);",
      },
      {
        name: "a string assembled for something other than module resolution is not a specifier",
        code: "export const read = async (base: string, id: string) => await fetch(base + id);",
      },
      {
        name: "a declaration written at the top of the file carries a string by grammar",
        code: 'import { reader } from "./reader.ts";\nexport const held = reader;',
      },
      {
        name: "a file covered by a registered exception is left to the grounds it carries",
        code: "export const loaded = import(chosen);",
        filename: HOST_FILE,
        options: [GROUNDED_EXCEPTION],
      },
    ],
    invalid: [
      {
        name: "a specifier read from a binding is decided while the program runs",
        documented: true,
        code: "export const loaded = import(chosen);",
        errors: [{ messageId: "unresolvableModuleSpecifier", data: { written: "chosen" } }],
      },
      {
        name: "a specifier handed in as an argument is decided while the program runs",
        code: "export const load = async (name: string) => await import(name);",
        errors: [{ messageId: "unresolvableModuleSpecifier", data: { written: "name" } }],
      },
      {
        name: "a specifier read off a property is decided while the program runs",
        code: "export const loaded = import(config.entry);",
        errors: [{ messageId: "unresolvableModuleSpecifier", data: { written: "config.entry" } }],
      },
      {
        name: "a specifier returned by a call is decided while the program runs",
        code: "export const loaded = import(pickEntry());",
        errors: [{ messageId: "unresolvableModuleSpecifier", data: { written: "pickEntry()" } }],
      },
      {
        name: "a constant bound to a call result is decided while the program runs",
        code: "const ENTRY = pickEntry();\nexport const loaded = import(ENTRY);",
        errors: [{ messageId: "unresolvableModuleSpecifier", data: { written: "ENTRY" } }],
      },
      {
        name: "a specifier chosen by a condition is more than one string",
        documented: true,
        code: 'export const loaded = import(wide ? "./wide.ts" : "./narrow.ts");',
        errors: [
          {
            messageId: "unresolvableModuleSpecifier",
            data: { written: 'wide ? "./wide.ts" : "./narrow.ts"' },
          },
        ],
      },
      {
        name: "a template with a substitution nobody can fold is decided while the program runs",
        code: "export const loaded = import(`./${chosen}.ts`);",
        errors: [
          { messageId: "unresolvableModuleSpecifier", data: { written: "`./${chosen}.ts`" } },
        ],
      },
      {
        name: "a synchronous request built at run time is decided while the program runs",
        code: "export const loaded = require(chosen);",
        errors: [{ messageId: "unresolvableModuleSpecifier", data: { written: "chosen" } }],
      },
      {
        name: "a registered form handed nothing the source spells out resolves to nothing",
        code: "export const loaded = import(new URL(chosen, import.meta.url).href);",
        errors: [
          {
            messageId: "unresolvableModuleSpecifier",
            data: { written: "new URL(chosen, import.meta.url).href" },
          },
        ],
      },
      {
        name: "an exception registered without grounds registers nothing that holds",
        code: "export const loaded = import(chosen);",
        filename: HOST_FILE,
        options: [GROUNDLESS_EXCEPTION],
        errors: [
          {
            messageId: "groundlessSpecifierException",
            data: { path: "**/plugin-host/**" },
          },
          { messageId: "unresolvableModuleSpecifier", data: { written: "chosen" } },
        ],
      },
    ],
  });
});
