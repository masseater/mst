import { describe, expect, test } from "vite-plus/test";

import { reachRouteOf } from "./reach-routes.ts";

const it = test
  .extend("routeOfAnImportDeclaration", () =>
    reachRouteOf(
      {
        type: "ImportDeclaration",
        importKind: "value",
        source: { type: "Literal", value: "retired-lib" },
      },
      new Map(),
    ))
  .extend("routeOfARequiredModule", () =>
    reachRouteOf(
      {
        type: "TSImportEqualsDeclaration",
        id: { type: "Identifier", name: "retired" },
        moduleReference: {
          type: "TSExternalModuleReference",
          expression: { type: "Literal", value: "retired-lib" },
        },
      },
      new Map(),
    ),
  )
  .extend("routeOfARequiredModuleNamedByAConstant", () =>
    reachRouteOf(
      {
        type: "TSImportEqualsDeclaration",
        id: { type: "Identifier", name: "retired" },
        moduleReference: {
          type: "TSExternalModuleReference",
          expression: { type: "Identifier", name: "RETIRED" },
        },
      },
      new Map([["RETIRED", "retired-lib"]]),
    ),
  )
  .extend("routeOfARequiredModuleWhoseExpressionIsNotANode", () =>
    reachRouteOf(
      {
        type: "TSImportEqualsDeclaration",
        id: { type: "Identifier", name: "retired" },
        moduleReference: { type: "TSExternalModuleReference", expression: "retired-lib" },
      },
      new Map(),
    ),
  )
  .extend("routeOfAnAliasOfAnotherNamespace", () =>
    reachRouteOf(
      {
        type: "TSImportEqualsDeclaration",
        id: { type: "Identifier", name: "retired" },
        moduleReference: {
          type: "TSQualifiedName",
          left: { type: "Identifier", name: "outer" },
          right: { type: "Identifier", name: "inner" },
        },
      },
      new Map(),
    ),
  )
  .extend("routeOfAnAliasWithoutAModuleReference", () =>
    reachRouteOf(
      { type: "TSImportEqualsDeclaration", id: { type: "Identifier", name: "retired" } },
      new Map(),
    ),
  )
  .extend("routeOfATypePositionImport", () =>
    reachRouteOf(
      { type: "TSImportType", source: { type: "Literal", value: "retired-lib" } },
      new Map(),
    ),
  )
  .extend("routeOfATypePositionImportWhoseSourceIsNotANode", () =>
    reachRouteOf({ type: "TSImportType", source: "retired-lib" }, new Map()),
  )
  .extend("routeOfADeclarationThatReachesNothing", () =>
    reachRouteOf({ type: "VariableDeclaration", kind: "const", declarations: [] }, new Map()),
  )
  .extend("routeOfAValueThatIsNotANode", () => reachRouteOf(null, new Map()));

describe("restricted-targets/reach-routes", () => {
  it("an import declaration reaches the module its source names", ({
    routeOfAnImportDeclaration,
  }) => {
    expect(routeOfAnImportDeclaration).toBe("retired-lib");
  });

  it("a required module reaches the module its reference names", ({ routeOfARequiredModule }) => {
    expect(routeOfARequiredModule).toBe("retired-lib");
  });

  it("a required module named by a constant of this file reaches what the constant spells", ({
    routeOfARequiredModuleNamedByAConstant,
  }) => {
    expect(routeOfARequiredModuleNamedByAConstant).toBe("retired-lib");
  });

  it("a required module whose expression is not a node reaches nothing", ({
    routeOfARequiredModuleWhoseExpressionIsNotANode,
  }) => {
    expect(routeOfARequiredModuleWhoseExpressionIsNotANode).toBe(null);
  });

  it("an alias standing for another namespace of this program reaches no module", ({
    routeOfAnAliasOfAnotherNamespace,
  }) => {
    expect(routeOfAnAliasOfAnotherNamespace).toBe(null);
  });

  it("an alias carrying no module reference at all reaches no module", ({
    routeOfAnAliasWithoutAModuleReference,
  }) => {
    expect(routeOfAnAliasWithoutAModuleReference).toBe(null);
  });

  it("an import written in a type position reaches the module its source names", ({
    routeOfATypePositionImport,
  }) => {
    expect(routeOfATypePositionImport).toBe("retired-lib");
  });

  it("an import written in a type position whose source is not a node reaches nothing", ({
    routeOfATypePositionImportWhoseSourceIsNotANode,
  }) => {
    expect(routeOfATypePositionImportWhoseSourceIsNotANode).toBe(null);
  });

  it("a declaration that names no module at all reaches nothing", ({
    routeOfADeclarationThatReachesNothing,
  }) => {
    expect(routeOfADeclarationThatReachesNothing).toBe(null);
  });

  it("a value that is not a node reaches nothing", ({ routeOfAValueThatIsNotANode }) => {
    expect(routeOfAValueThatIsNotANode).toBe(null);
  });
});
