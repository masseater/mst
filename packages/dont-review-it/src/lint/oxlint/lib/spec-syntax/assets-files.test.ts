import { describe, expect, test } from "vite-plus/test";

import { assetsNameMarkersFrom, assetsStemOf } from "./assets-files.ts";

const it = test
  .extend("markersTakenFromEmptyOptions", () => assetsNameMarkersFrom([]))
  .extend("markersTakenFromASpelledOutList", () =>
    assetsNameMarkersFrom([{ assetsNameMarkers: ["fixtures"] }]),
  )
  .extend("stemOfANameCarryingTheMarker", () =>
    assetsStemOf("order.assets.ts", assetsNameMarkersFrom([])),
  )
  .extend("stemOfANameBelowADirectory", () =>
    assetsStemOf("src/checks/order.assets.ts", assetsNameMarkersFrom([])),
  )
  .extend("stemOfANameCarryingAnotherMarker", () =>
    assetsStemOf("order.helpers.ts", assetsNameMarkersFrom([])),
  )
  .extend("stemOfANameThatIsTheMarkerAlone", () =>
    assetsStemOf("assets.ts", assetsNameMarkersFrom([])),
  )
  .extend("stemOfANameWithoutAnExtension", () => assetsStemOf("assets", assetsNameMarkersFrom([])))
  .extend("stemOfANameEndingAtTheSeparator", () =>
    assetsStemOf("order.assets.", assetsNameMarkersFrom([])),
  );

describe("spec-syntax/assets-files", () => {
  it("options that name no markers leave the carried marker in force", ({
    markersTakenFromEmptyOptions,
  }) => {
    expect(markersTakenFromEmptyOptions).toStrictEqual(new Set(["assets"]));
  });

  it("options that spell out markers put those markers in force", ({
    markersTakenFromASpelledOutList,
  }) => {
    expect(markersTakenFromASpelledOutList).toStrictEqual(new Set(["fixtures"]));
  });

  it("a name carrying the marker stands for the spec it belongs to", ({
    stemOfANameCarryingTheMarker,
  }) => {
    expect(stemOfANameCarryingTheMarker).toBe("order");
  });

  it("a name below a directory is read from its last segment alone", ({
    stemOfANameBelowADirectory,
  }) => {
    expect(stemOfANameBelowADirectory).toBe("order");
  });

  it("a name carrying another marker stands for no spec", ({
    stemOfANameCarryingAnotherMarker,
  }) => {
    expect(stemOfANameCarryingAnotherMarker).toBe(null);
  });

  it("a name that is the marker and nothing else stands for no spec", ({
    stemOfANameThatIsTheMarkerAlone,
  }) => {
    expect(stemOfANameThatIsTheMarkerAlone).toBe(null);
  });

  it("a name written without an extension stands for no spec", ({
    stemOfANameWithoutAnExtension,
  }) => {
    expect(stemOfANameWithoutAnExtension).toBe(null);
  });

  it("a name that ends at the separator carries no extension to read", ({
    stemOfANameEndingAtTheSeparator,
  }) => {
    expect(stemOfANameEndingAtTheSeparator).toBe(null);
  });
});
