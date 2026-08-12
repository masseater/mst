import { describe, expect, test } from "vite-plus/test";

import { assetsNameMarkersFrom, assetsStemOf } from "./assets-files.ts";

const markers: ReadonlySet<string> = assetsNameMarkersFrom([]);

const replacedMarkers: ReadonlySet<string> = assetsNameMarkersFrom([
  { assetsNameMarkers: ["fixtures"] },
]);

const listedMarkers: ReadonlySet<string> = assetsNameMarkersFrom([
  { assetsNameMarkers: ["assets", "fixtures"] },
]);

describe("assets-files", () => {
  test("a name spelled as stem, marker and extension names the stem it belongs to", () => {
    expect(assetsStemOf("/repo/owner/order.assets.ts", markers)).toBe("order");
  });

  test("a stem holding separators of its own stays whole in front of the marker", () => {
    expect(assetsStemOf("/repo/owner/vite.config.assets.ts", markers)).toBe("vite.config");
  });

  test("the extension the data is written in takes no part in the stem", () => {
    expect(assetsStemOf("/repo/owner/order.assets.json", markers)).toBe("order");
    expect(assetsStemOf("/repo/owner/order.assets.yaml", markers)).toBe("order");
  });

  test("a name written with backslash separators names the same stem", () => {
    expect(assetsStemOf(String.raw`C:\repo\owner\order.assets.ts`, markers)).toBe("order");
  });

  test("a name carrying no configured marker names no stem", () => {
    expect(assetsStemOf("/repo/owner/order.ts", markers)).toBe(null);
    expect(assetsStemOf("/repo/owner/order.fixtures.ts", markers)).toBe(null);
  });

  test("a directory named like test data does not make the files inside it test data", () => {
    expect(assetsStemOf("/repo/owner/order.assets.ts/table.ts", markers)).toBe(null);
  });

  test("a name holding no separator at all names no stem", () => {
    expect(assetsStemOf("/repo/owner/assets", markers)).toBe(null);
  });

  test("a name that carries the marker with no stem in front of it names no stem", () => {
    expect(assetsStemOf("/repo/owner/assets.ts", markers)).toBe(null);
    expect(assetsStemOf("/repo/owner/.assets.ts", markers)).toBe(null);
  });

  test("a name ending at the separator carries no extension and names no stem", () => {
    expect(assetsStemOf("/repo/owner/order.assets.", markers)).toBe(null);
  });

  test("a rule run without settings looks for the marker the rule itself carries", () => {
    expect(assetsNameMarkersFrom([])).toStrictEqual(new Set(["assets"]));
    expect(assetsNameMarkersFrom([{}])).toStrictEqual(new Set(["assets"]));
    expect(assetsNameMarkersFrom(["error"])).toStrictEqual(new Set(["assets"]));
  });

  test("a repository that names its test data differently replaces the marker entirely", () => {
    expect(replacedMarkers).toStrictEqual(new Set(["fixtures"]));
  });

  test("the replaced marker names the stem and the default marker stops naming one", () => {
    expect(assetsStemOf("/repo/owner/order.fixtures.ts", replacedMarkers)).toBe("order");
    expect(assetsStemOf("/repo/owner/order.assets.ts", replacedMarkers)).toBe(null);
  });

  test("a name carrying any marker on the configured list names its stem", () => {
    expect(assetsStemOf("/repo/owner/order.assets.ts", listedMarkers)).toBe("order");
    expect(assetsStemOf("/repo/owner/order.fixtures.ts", listedMarkers)).toBe("order");
  });

  test("an empty list of markers leaves the marker the rule carries in place", () => {
    expect(assetsNameMarkersFrom([{ assetsNameMarkers: [] }])).toStrictEqual(new Set(["assets"]));
  });

  test("entries that are not markers are dropped from the configured list", () => {
    expect(assetsNameMarkersFrom([{ assetsNameMarkers: ["fixtures", 7] }])).toStrictEqual(
      new Set(["fixtures"]),
    );
  });
});
