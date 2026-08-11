import { describe, expect, test } from "vite-plus/test";

import {
  buildTypeAuthorityIndex,
  carriesNonTrivialStructure,
  workspaceNameKeyOf,
  type ScannedTypeFile,
} from "./authority-index.ts";
import { typeDeclarationsIn } from "./type-declarations.ts";

const WORKSPACE = "packages/order";

const fileAt = (relativePath: string, source: string): ScannedTypeFile => ({
  relativePath,
  workspacePath: WORKSPACE,
  declarations: typeDeclarationsIn(source),
});

const THREE_NAMED_MEMBERS =
  "export type Shape = { readonly a: string; readonly b: number; readonly c: Named };";

describe("buildTypeAuthorityIndex", () => {
  test("every scanned file is reachable by the path it was scanned at", () => {
    const index = buildTypeAuthorityIndex([
      fileAt("packages/order/src/a.ts", THREE_NAMED_MEMBERS),
      fileAt("packages/order/src/b.ts", THREE_NAMED_MEMBERS),
    ]);

    expect([...index.typesByPath.keys()]).toStrictEqual([
      "packages/order/src/a.ts",
      "packages/order/src/b.ts",
    ]);
  });

  test("two declarations of one interface name in one file stand as a single type", () => {
    const index = buildTypeAuthorityIndex([
      fileAt(
        "packages/order/src/a.ts",
        "export interface Shape { readonly a: string }\nexport interface Shape { readonly b: Named }\n",
      ),
    ]);

    expect(index.typesByPath.get("packages/order/src/a.ts")?.length).toBe(1);
  });

  test("a merged interface carries the members of both of its declarations", () => {
    const index = buildTypeAuthorityIndex([
      fileAt(
        "packages/order/src/a.ts",
        "export interface Shape { readonly a: string }\nexport interface Shape { readonly b: Named }\n",
      ),
    ]);

    expect(index.typesByPath.get("packages/order/src/a.ts")?.[0]?.memberCount).toBe(2);
  });

  test("a merged interface is placed at the first of its declarations", () => {
    const index = buildTypeAuthorityIndex([
      fileAt(
        "packages/order/src/a.ts",
        "export interface Shape { readonly a: string }\nexport interface Shape { readonly b: Named }\n",
      ),
    ]);

    expect(index.typesByPath.get("packages/order/src/a.ts")?.[0]?.line).toBe(1);
  });

  test("a merged interface reads the same however its declarations were split", () => {
    const split = buildTypeAuthorityIndex([
      fileAt(
        "packages/order/src/a.ts",
        "export interface Shape { readonly a: string }\nexport interface Shape { readonly b: Named }\n",
      ),
    ]);
    const whole = buildTypeAuthorityIndex([
      fileAt(
        "packages/order/src/b.ts",
        "export interface Shape { readonly a: string; readonly b: Named }\n",
      ),
    ]);

    expect(split.typesByPath.get("packages/order/src/a.ts")?.[0]?.structureForm).toBe(
      whole.typesByPath.get("packages/order/src/b.ts")?.[0]?.structureForm,
    );
  });

  test("types sharing a name inside one workspace are gathered under one key", () => {
    const index = buildTypeAuthorityIndex([
      fileAt("packages/order/src/a.ts", THREE_NAMED_MEMBERS),
      fileAt("packages/order/src/b.ts", "export type Shape = { readonly a: string };"),
    ]);

    expect(
      index.sitesByWorkspaceName
        .get(workspaceNameKeyOf({ workspacePath: WORKSPACE, name: "Shape" }))
        ?.map((site) => site.relativePath),
    ).toStrictEqual(["packages/order/src/a.ts", "packages/order/src/b.ts"]);
  });

  test("a structure carrying enough named members is gathered under its own form", () => {
    const index = buildTypeAuthorityIndex([
      fileAt("packages/order/src/a.ts", THREE_NAMED_MEMBERS),
      fileAt(
        "packages/order/src/b.ts",
        "export type Other = { readonly a: string; readonly b: number; readonly c: Named };",
      ),
    ]);

    expect([...index.sitesByStructure.values()].map((sites) => sites.length)).toStrictEqual([2]);
  });

  test("a structure carrying too few members is left out of the structural gathering", () => {
    const index = buildTypeAuthorityIndex([
      fileAt("packages/order/src/a.ts", "export type Shape = { readonly a: Named };"),
      fileAt("packages/order/src/b.ts", "export type Other = { readonly a: Named };"),
    ]);

    expect([...index.sitesByStructure.keys()]).toStrictEqual([]);
  });

  test("a structure reaching no named type is left out of the structural gathering", () => {
    const index = buildTypeAuthorityIndex([
      fileAt(
        "packages/order/src/a.ts",
        "export type Shape = { readonly a: string; readonly b: number; readonly c: boolean };",
      ),
    ]);

    expect([...index.sitesByStructure.keys()]).toStrictEqual([]);
  });

  test("sites gathered under one key are ordered by path and then by line", () => {
    const index = buildTypeAuthorityIndex([
      fileAt("packages/order/src/b.ts", THREE_NAMED_MEMBERS),
      fileAt("packages/order/src/a.ts", THREE_NAMED_MEMBERS),
    ]);

    expect(
      [...index.sitesByStructure.values()].flatMap((sites) =>
        sites.map((site) => site.relativePath),
      ),
    ).toStrictEqual(["packages/order/src/a.ts", "packages/order/src/b.ts"]);
  });
});

describe("carriesNonTrivialStructure", () => {
  test("a structure with enough members that reaches a named type carries weight", () => {
    expect(carriesNonTrivialStructure({ memberCount: 3, referencesNamedType: true })).toBe(true);
  });

  test("a structure with too few members carries no weight", () => {
    expect(carriesNonTrivialStructure({ memberCount: 2, referencesNamedType: true })).toBe(false);
  });

  test("a structure that reaches no named type carries no weight", () => {
    expect(carriesNonTrivialStructure({ memberCount: 9, referencesNamedType: false })).toBe(false);
  });
});
