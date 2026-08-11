import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { astFieldsOf, constantSpecifiersIn, statementsOf } from "./setup-modules/coupling-edges.ts";
import {
  namesStaticallyResolvedForm,
  STATICALLY_RESOLVED_FORMS,
} from "./statically-resolved-forms.ts";

const namesForm = (
  sourceText: string,
  forms: ReadonlySet<string> = new Set(STATICALLY_RESOLVED_FORMS),
): boolean => {
  const program = astFieldsOf(parseSync("spec.ts", sourceText).program);
  if (program === null) throw new Error(`nothing was parsed from: ${sourceText}`);

  const [statement] = statementsOf(program).slice(-1);
  const written = statement === undefined ? null : astFieldsOf(statement.expression);
  if (written === null) throw new Error(`nothing is written by: ${sourceText}`);
  return namesStaticallyResolvedForm({
    node: written,
    forms,
    constants: constantSpecifiersIn(program.body),
  });
};

describe("statically-resolved-forms", () => {
  test("a location built from this module's own address names a registered form", () => {
    expect(namesForm('new URL("./worker.ts", import.meta.url).href;')).toBe(true);
  });

  test("a resolution asked of this module's own address names a registered form", () => {
    expect(namesForm('import.meta.resolve("./worker.ts");')).toBe(true);
  });

  test("a registered form handed nothing the source spells out names no resolved location", () => {
    expect(namesForm("new URL(chosen, import.meta.url).href;")).toBe(false);
  });

  test("a registered form handed a constant of this file names a resolved location", () => {
    expect(namesForm('const ENTRY = "./worker.ts";\nnew URL(ENTRY, import.meta.url).href;')).toBe(
      true,
    );
  });

  test("a form nobody registered names no resolved location", () => {
    expect(namesForm('resolveEntry("./worker.ts");')).toBe(false);
  });

  test("a form registered under another name is read from the list it is given", () => {
    expect(namesForm('resolveEntry("./worker.ts");', new Set(["resolveEntry"]))).toBe(true);
  });

  test("a property read off an object names no form at all", () => {
    expect(namesForm("config.entry;")).toBe(false);
  });

  test("a name bound to a value names no form at all", () => {
    expect(namesForm("chosen;")).toBe(false);
  });

  test("a call reached through a subscript spells no head this list can hold", () => {
    expect(namesForm('loaders[chosen]("./worker.ts");')).toBe(false);
  });

  test("a head carried by a subscript spells no dotted name this list can hold", () => {
    expect(namesForm('loaders[chosen].load("./worker.ts");')).toBe(false);
  });

  test("a form waited on is read through the wait", () => {
    expect(namesForm('await import.meta.resolve("./worker.ts");')).toBe(true);
  });
});
