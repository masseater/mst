import { describe, expect, test } from "vite-plus/test";

import { reachRouteOf } from "./reach-routes.ts";

describe("reachRouteOf", () => {
  describe("an import declaration", () => {
    const it = test.extend("route", () =>
      reachRouteOf(
        {
          type: "ImportDeclaration",
          importKind: "value",
          source: { type: "Literal", value: "retired-lib" },
        },
        new Map(),
      ));

    it("reaches the module its source names", ({ route }) => {
      expect(route).toBe("retired-lib");
    });
  });

  describe("an import of types alone", () => {
    const it = test.extend("route", () =>
      reachRouteOf(
        {
          type: "ImportDeclaration",
          importKind: "type",
          source: { type: "Literal", value: "retired-lib" },
        },
        new Map(),
      ));

    it("reaches the module it names", ({ route }) => {
      expect(route).toBe("retired-lib");
    });
  });

  describe("a re-export", () => {
    const it = test.extend("route", () =>
      reachRouteOf(
        {
          type: "ExportNamedDeclaration",
          exportKind: "value",
          source: { type: "Literal", value: "retired-lib" },
        },
        new Map(),
      ));

    it("reaches the module it names", ({ route }) => {
      expect(route).toBe("retired-lib");
    });
  });

  describe("a dynamic import", () => {
    const it = test.extend("route", () =>
      reachRouteOf(
        { type: "ImportExpression", source: { type: "Literal", value: "retired-lib" } },
        new Map(),
      ));

    it("reaches the module it names", ({ route }) => {
      expect(route).toBe("retired-lib");
    });
  });

  describe("a required module", () => {
    const it = test.extend("route", () =>
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
      ));

    it("reaches the module its reference names", ({ route }) => {
      expect(route).toBe("retired-lib");
    });
  });

  describe("a required module named by a constant of this file", () => {
    const it = test.extend("route", () =>
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
      ));

    it("reaches what the constant spells", ({ route }) => {
      expect(route).toBe("retired-lib");
    });
  });

  describe("a required module whose expression is not a node", () => {
    const it = test.extend("route", () =>
      reachRouteOf(
        {
          type: "TSImportEqualsDeclaration",
          id: { type: "Identifier", name: "retired" },
          moduleReference: { type: "TSExternalModuleReference", expression: "retired-lib" },
        },
        new Map(),
      ));

    it("reaches nothing", ({ route }) => {
      expect(route).toBe(null);
    });
  });

  describe("an alias standing for another namespace of this program", () => {
    const it = test.extend("route", () =>
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
      ));

    it("reaches no module", ({ route }) => {
      expect(route).toBe(null);
    });
  });

  describe("an alias carrying no module reference at all", () => {
    const it = test.extend("route", () =>
      reachRouteOf(
        { type: "TSImportEqualsDeclaration", id: { type: "Identifier", name: "retired" } },
        new Map(),
      ));

    it("reaches no module", ({ route }) => {
      expect(route).toBe(null);
    });
  });

  describe("an import written in a type position", () => {
    const it = test.extend("route", () =>
      reachRouteOf(
        { type: "TSImportType", source: { type: "Literal", value: "retired-lib" } },
        new Map(),
      ));

    it("reaches the module its source names", ({ route }) => {
      expect(route).toBe("retired-lib");
    });
  });

  describe("an import written in a type position whose source is not a node", () => {
    const it = test.extend("route", () =>
      reachRouteOf({ type: "TSImportType", source: "retired-lib" }, new Map()));

    it("reaches nothing", ({ route }) => {
      expect(route).toBe(null);
    });
  });

  describe("a declaration that names no module at all", () => {
    const it = test.extend("route", () =>
      reachRouteOf({ type: "VariableDeclaration", kind: "const", declarations: [] }, new Map()));

    it("reaches nothing", ({ route }) => {
      expect(route).toBe(null);
    });
  });

  describe("a value that is not a node", () => {
    const it = test.extend("route", () => reachRouteOf(null, new Map()));

    it("reaches nothing", ({ route }) => {
      expect(route).toBe(null);
    });
  });
});
