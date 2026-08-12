import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { astFieldsOf, statementsOf } from "./setup-modules/coupling-edges.ts";
import {
  namesStaticallyResolvedForm,
  STATICALLY_RESOLVED_FORMS,
} from "./statically-resolved-forms.ts";

const it = test
  .extend("verdictOnLocationBuiltFromOwnAddress", () => {
    const program = astFieldsOf(
      parseSync("spec.ts", 'new URL("./worker.ts", import.meta.url).href;').program,
    );
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program).slice(-1);
    const written = statement === undefined ? null : astFieldsOf(statement.expression);
    if (written === null) throw new Error("nothing is written");
    return namesStaticallyResolvedForm({
      node: written,
      forms: new Set(STATICALLY_RESOLVED_FORMS),
      constants: new Map<string, string>(),
    });
  })
  .extend("verdictOnResolutionAskedOfOwnAddress", () => {
    const program = astFieldsOf(
      parseSync("spec.ts", 'import.meta.resolve("./worker.ts");').program,
    );
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program).slice(-1);
    const written = statement === undefined ? null : astFieldsOf(statement.expression);
    if (written === null) throw new Error("nothing is written");
    return namesStaticallyResolvedForm({
      node: written,
      forms: new Set(STATICALLY_RESOLVED_FORMS),
      constants: new Map<string, string>(),
    });
  })
  .extend("verdictOnFormHandedAName", () => {
    const program = astFieldsOf(
      parseSync("spec.ts", "new URL(chosen, import.meta.url).href;").program,
    );
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program).slice(-1);
    const written = statement === undefined ? null : astFieldsOf(statement.expression);
    if (written === null) throw new Error("nothing is written");
    return namesStaticallyResolvedForm({
      node: written,
      forms: new Set(STATICALLY_RESOLVED_FORMS),
      constants: new Map<string, string>(),
    });
  })
  .extend("verdictOnFormHandedAConstantOfThisFile", () => {
    const program = astFieldsOf(
      parseSync("spec.ts", 'const ENTRY = "./worker.ts";\nnew URL(ENTRY, import.meta.url).href;')
        .program,
    );
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program).slice(-1);
    const written = statement === undefined ? null : astFieldsOf(statement.expression);
    if (written === null) throw new Error("nothing is written");
    return namesStaticallyResolvedForm({
      node: written,
      forms: new Set(STATICALLY_RESOLVED_FORMS),
      constants: new Map([["ENTRY", "./worker.ts"]]),
    });
  })
  .extend("verdictOnUnregisteredForm", () => {
    const program = astFieldsOf(parseSync("spec.ts", 'resolveEntry("./worker.ts");').program);
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program).slice(-1);
    const written = statement === undefined ? null : astFieldsOf(statement.expression);
    if (written === null) throw new Error("nothing is written");
    return namesStaticallyResolvedForm({
      node: written,
      forms: new Set(STATICALLY_RESOLVED_FORMS),
      constants: new Map<string, string>(),
    });
  })
  .extend("verdictOnFormRegisteredUnderAnotherName", () => {
    const program = astFieldsOf(parseSync("spec.ts", 'resolveEntry("./worker.ts");').program);
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program).slice(-1);
    const written = statement === undefined ? null : astFieldsOf(statement.expression);
    if (written === null) throw new Error("nothing is written");
    return namesStaticallyResolvedForm({
      node: written,
      forms: new Set(["resolveEntry"]),
      constants: new Map<string, string>(),
    });
  })
  .extend("verdictOnPropertyRead", () => {
    const program = astFieldsOf(parseSync("spec.ts", "config.entry;").program);
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program).slice(-1);
    const written = statement === undefined ? null : astFieldsOf(statement.expression);
    if (written === null) throw new Error("nothing is written");
    return namesStaticallyResolvedForm({
      node: written,
      forms: new Set(STATICALLY_RESOLVED_FORMS),
      constants: new Map<string, string>(),
    });
  })
  .extend("verdictOnBoundName", () => {
    const program = astFieldsOf(parseSync("spec.ts", "chosen;").program);
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program).slice(-1);
    const written = statement === undefined ? null : astFieldsOf(statement.expression);
    if (written === null) throw new Error("nothing is written");
    return namesStaticallyResolvedForm({
      node: written,
      forms: new Set(STATICALLY_RESOLVED_FORMS),
      constants: new Map<string, string>(),
    });
  })
  .extend("verdictOnCallReachedThroughSubscript", () => {
    const program = astFieldsOf(parseSync("spec.ts", 'loaders[chosen]("./worker.ts");').program);
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program).slice(-1);
    const written = statement === undefined ? null : astFieldsOf(statement.expression);
    if (written === null) throw new Error("nothing is written");
    return namesStaticallyResolvedForm({
      node: written,
      forms: new Set(STATICALLY_RESOLVED_FORMS),
      constants: new Map<string, string>(),
    });
  })
  .extend("verdictOnHeadCarriedBySubscript", () => {
    const program = astFieldsOf(
      parseSync("spec.ts", 'loaders[chosen].load("./worker.ts");').program,
    );
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program).slice(-1);
    const written = statement === undefined ? null : astFieldsOf(statement.expression);
    if (written === null) throw new Error("nothing is written");
    return namesStaticallyResolvedForm({
      node: written,
      forms: new Set(STATICALLY_RESOLVED_FORMS),
      constants: new Map<string, string>(),
    });
  })
  .extend("verdictOnFormWaitedOn", () => {
    const program = astFieldsOf(
      parseSync("spec.ts", 'await import.meta.resolve("./worker.ts");').program,
    );
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program).slice(-1);
    const written = statement === undefined ? null : astFieldsOf(statement.expression);
    if (written === null) throw new Error("nothing is written");
    return namesStaticallyResolvedForm({
      node: written,
      forms: new Set(STATICALLY_RESOLVED_FORMS),
      constants: new Map<string, string>(),
    });
  });

describe("statically-resolved-forms", () => {
  it("a location built from this module's own address names a registered form", ({
    verdictOnLocationBuiltFromOwnAddress,
  }) => {
    expect(verdictOnLocationBuiltFromOwnAddress).toBe(true);
  });

  it("a resolution asked of this module's own address names a registered form", ({
    verdictOnResolutionAskedOfOwnAddress,
  }) => {
    expect(verdictOnResolutionAskedOfOwnAddress).toBe(true);
  });

  it("a registered form handed nothing the source spells out names no resolved location", ({
    verdictOnFormHandedAName,
  }) => {
    expect(verdictOnFormHandedAName).toBe(false);
  });

  it("a registered form handed a constant of this file names a resolved location", ({
    verdictOnFormHandedAConstantOfThisFile,
  }) => {
    expect(verdictOnFormHandedAConstantOfThisFile).toBe(true);
  });

  it("a form nobody registered names no resolved location", ({ verdictOnUnregisteredForm }) => {
    expect(verdictOnUnregisteredForm).toBe(false);
  });

  it("a form registered under another name is read from the list it is given", ({
    verdictOnFormRegisteredUnderAnotherName,
  }) => {
    expect(verdictOnFormRegisteredUnderAnotherName).toBe(true);
  });

  it("a property read off an object names no form at all", ({ verdictOnPropertyRead }) => {
    expect(verdictOnPropertyRead).toBe(false);
  });

  it("a name bound to a value names no form at all", ({ verdictOnBoundName }) => {
    expect(verdictOnBoundName).toBe(false);
  });

  it("a call reached through a subscript spells no head this list can hold", ({
    verdictOnCallReachedThroughSubscript,
  }) => {
    expect(verdictOnCallReachedThroughSubscript).toBe(false);
  });

  it("a head carried by a subscript spells no dotted name this list can hold", ({
    verdictOnHeadCarriedBySubscript,
  }) => {
    expect(verdictOnHeadCarriedBySubscript).toBe(false);
  });

  it("a form waited on is read through the wait", ({ verdictOnFormWaitedOn }) => {
    expect(verdictOnFormWaitedOn).toBe(true);
  });
});
