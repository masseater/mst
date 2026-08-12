import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  constructedHostTypeOf,
  hostObjectTypesFrom,
  runtimeModulesFrom,
  type HostTypeLookup,
} from "./host-object-constructions.ts";

import type { ESTree } from "@oxlint/plugins";

const expressionIn = (source: string): ESTree.Expression => {
  const declared = parseSync("spec.ts", `const written = ${source};`).program
    .body[0] as ESTree.Statement;
  const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
  return declarator?.init as ESTree.Expression;
};

const runtimeLookup: HostTypeLookup = {
  named: (name) => (name === "Request" || name === "Response" ? name : null),
  qualified: (namespace, member) =>
    namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
};

const ownedLookup: HostTypeLookup = { named: () => null, qualified: () => null };
describe("host-object-constructions", () => {
  test("a construction of a name the runtime declares is that host type", () => {
    expect(constructedHostTypeOf(expressionIn("new Response('a')"), runtimeLookup)).toBe(
      "Response",
    );
    expect(
      constructedHostTypeOf(expressionIn("new Request('https://example.test/')"), runtimeLookup),
    ).toBe("Request");
  });

  test("a construction of a name the caller declares is not a host type", () => {
    expect(constructedHostTypeOf(expressionIn("new Response('a')"), ownedLookup)).toBeNull();
  });

  test("a construction of an unrelated name is not a host type", () => {
    expect(constructedHostTypeOf(expressionIn("new Date(0)"), runtimeLookup)).toBeNull();
  });

  test("a construction reached through a runtime namespace is that host type", () => {
    expect(constructedHostTypeOf(expressionIn("new undici.Response('a')"), runtimeLookup)).toBe(
      "Response",
    );
  });

  test("a construction reached through an unrelated namespace is not a host type", () => {
    expect(
      constructedHostTypeOf(expressionIn("new helpers.Response('a')"), runtimeLookup),
    ).toBeNull();
  });

  test("a constructor named at run time is not a host type", () => {
    expect(
      constructedHostTypeOf(expressionIn("new globalThis[name]('a')"), runtimeLookup),
    ).toBeNull();
    expect(constructedHostTypeOf(expressionIn("new (build())('a')"), runtimeLookup)).toBeNull();
  });

  test("the standard factories hand back the same host type a construction does", () => {
    expect(constructedHostTypeOf(expressionIn("Response.json({ id: 1 })"), runtimeLookup)).toBe(
      "Response",
    );
    expect(constructedHostTypeOf(expressionIn("Response.redirect('/next')"), runtimeLookup)).toBe(
      "Response",
    );
    expect(constructedHostTypeOf(expressionIn("Response.error()"), runtimeLookup)).toBe("Response");
  });

  test("a factory reached through a runtime namespace hands back the same host type", () => {
    expect(
      constructedHostTypeOf(expressionIn("undici.Response.json({ id: 1 })"), runtimeLookup),
    ).toBe("Response");
  });

  test("a method that is not one of the standard factories is not a construction", () => {
    expect(constructedHostTypeOf(expressionIn("Response.clone()"), runtimeLookup)).toBeNull();
  });

  test("a host type the runtime gives no factory to has no factory call to read", () => {
    expect(
      constructedHostTypeOf(expressionIn("Request.json({ id: 1 })"), runtimeLookup),
    ).toBeNull();
  });

  test("a method named at run time is not a factory call", () => {
    expect(constructedHostTypeOf(expressionIn("Response[member]()"), runtimeLookup)).toBeNull();
  });

  test("a call on something other than a name is not a factory call", () => {
    expect(
      constructedHostTypeOf(expressionIn("build().json({ id: 1 })"), runtimeLookup),
    ).toBeNull();
    expect(constructedHostTypeOf(expressionIn("read()"), runtimeLookup)).toBeNull();
  });

  test("a value that is neither a construction nor a factory call is not a host type", () => {
    expect(constructedHostTypeOf(expressionIn("subject"), runtimeLookup)).toBeNull();
    expect(constructedHostTypeOf(expressionIn("{ status: 200 }"), runtimeLookup)).toBeNull();
  });

  test("the roster and the runtime module list stand until the repository replaces them", () => {
    const carriedRoster = ["Request", "Response"];
    expect([...hostObjectTypesFrom([])]).toStrictEqual(carriedRoster);
    expect([...runtimeModulesFrom([])]).toStrictEqual(["undici"]);
    expect([...hostObjectTypesFrom(["error"])]).toStrictEqual(carriedRoster);
    expect([...hostObjectTypesFrom([{ hostObjectTypes: "Response" }])]).toStrictEqual(
      carriedRoster,
    );
    expect([...hostObjectTypesFrom([{ hostObjectTypes: [] }])]).toStrictEqual(carriedRoster);
    expect([...hostObjectTypesFrom([{ hostObjectTypes: [1] }])]).toStrictEqual(carriedRoster);
  });

  test("a repository that names its own roster is taken at its word", () => {
    expect([...hostObjectTypesFrom([{ hostObjectTypes: ["Headers"] }])]).toStrictEqual(["Headers"]);
    expect([...runtimeModulesFrom([{ runtimeModules: ["@internal/http"] }])]).toStrictEqual([
      "@internal/http",
    ]);
  });
});
