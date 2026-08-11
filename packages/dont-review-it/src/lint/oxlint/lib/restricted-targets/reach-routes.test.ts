import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  astFieldsOf,
  constantSpecifiersIn,
  statementsOf,
} from "../setup-modules/coupling-edges.ts";
import { reachRouteOf } from "./reach-routes.ts";

import type { AstFields } from "../ast-node.ts";

const programIn = (sourceText: string): AstFields => {
  const program = astFieldsOf(parseSync("reader.ts", sourceText).program);
  if (program === null) throw new Error(`nothing was parsed from: ${sourceText}`);
  return program;
};

const declaredRouteIn = (sourceText: string): string | null => {
  const program = programIn(sourceText);
  return reachRouteOf(statementsOf(program).at(0), constantSpecifiersIn(program.body));
};

const requestedRouteIn = (sourceText: string): string | null => {
  const program = programIn(sourceText);
  return reachRouteOf(statementsOf(program).at(-1)?.expression, constantSpecifiersIn(program.body));
};

const typePositionRouteIn = (sourceText: string): string | null => {
  const program = programIn(sourceText);
  return reachRouteOf(
    statementsOf(program).at(0)?.typeAnnotation,
    constantSpecifiersIn(program.body),
  );
};

describe("restricted-targets/reach-routes", () => {
  test("an import declaration reaches the module it names", () => {
    expect(declaredRouteIn('import { readFile } from "retired-lib";')).toBe("retired-lib");
  });

  test("an import of types alone reaches the module it names", () => {
    expect(declaredRouteIn('import type { Held } from "retired-lib";')).toBe("retired-lib");
  });

  test("a re-export reaches the module it names", () => {
    expect(declaredRouteIn('export { readFile } from "retired-lib";')).toBe("retired-lib");
  });

  test("a dynamic import reaches the module it names", () => {
    expect(requestedRouteIn('import("retired-lib");')).toBe("retired-lib");
  });

  test("a require call reaches the module it names", () => {
    expect(requestedRouteIn('require("retired-lib");')).toBe("retired-lib");
  });

  test("a specifier bound to a constant of this file is folded before the route is read", () => {
    expect(requestedRouteIn('const NAME = "retired-lib";\nimport(NAME);')).toBe("retired-lib");
  });

  test("an import written as a require assignment reaches the module it names", () => {
    expect(declaredRouteIn('import required = require("retired-lib");')).toBe("retired-lib");
  });

  test("an import written in type position reaches the module it names", () => {
    expect(typePositionRouteIn('type Held = import("retired-lib").Held;')).toBe("retired-lib");
  });

  test("an assignment naming something already in scope leaves this file reaching nothing", () => {
    expect(declaredRouteIn("import inner = outer.inner;")).toBe(null);
  });

  test("a declaration this module writes itself reaches nothing", () => {
    expect(declaredRouteIn("const total = 1;")).toBe(null);
  });

  test("a value that is not a node reaches nothing", () => {
    expect(reachRouteOf(null, new Map())).toBe(null);
  });

  test("an import assignment holding nothing to require reaches nothing", () => {
    expect(
      reachRouteOf(
        {
          type: "TSImportEqualsDeclaration",
          moduleReference: { type: "TSExternalModuleReference" },
        },
        new Map(),
      ),
    ).toBe(null);
  });

  test("an import in type position holding no source reaches nothing", () => {
    expect(reachRouteOf({ type: "TSImportType" }, new Map())).toBe(null);
  });
});
