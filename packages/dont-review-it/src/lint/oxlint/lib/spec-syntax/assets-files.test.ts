import { describe, expect, test } from "vite-plus/test";

import { assetsNameMarkersFrom, assetsStemOf } from "./assets-files.ts";

describe("assetsNameMarkersFrom", () => {
  describe("options that name no markers", () => {
    const it = test.extend("markers", () => assetsNameMarkersFrom([]));

    it("leaves the carried marker in force", ({ markers }) => {
      expect(markers).toStrictEqual(new Set(["assets"]));
    });
  });

  describe("an entry that names no markers", () => {
    const it = test.extend("markers", () => assetsNameMarkersFrom([{}]));

    it("leaves the carried marker in force", ({ markers }) => {
      expect(markers).toStrictEqual(new Set(["assets"]));
    });
  });

  describe("options that carry a severity alone", () => {
    const it = test.extend("markers", () => assetsNameMarkersFrom(["error"]));

    it("leaves the carried marker in force", ({ markers }) => {
      expect(markers).toStrictEqual(new Set(["assets"]));
    });
  });

  describe("options that spell out markers", () => {
    const it = test.extend("markers", () =>
      assetsNameMarkersFrom([{ assetsNameMarkers: ["fixtures"] }]));

    it("puts those markers in force", ({ markers }) => {
      expect(markers).toStrictEqual(new Set(["fixtures"]));
    });
  });

  describe("an empty list of markers", () => {
    const it = test.extend("markers", () => assetsNameMarkersFrom([{ assetsNameMarkers: [] }]));

    it("leaves the carried marker in force", ({ markers }) => {
      expect(markers).toStrictEqual(new Set(["assets"]));
    });
  });

  describe("a spelled out list holding an entry that is not a marker", () => {
    const it = test.extend("markers", () =>
      assetsNameMarkersFrom([{ assetsNameMarkers: ["fixtures", 7] }]));

    it("drops that entry from the list", ({ markers }) => {
      expect(markers).toStrictEqual(new Set(["fixtures"]));
    });
  });
});

describe("assetsStemOf", () => {
  describe("under the carried marker", () => {
    describe("a name carrying the marker", () => {
      const it = test.extend("stem", () =>
        assetsStemOf("order.assets.ts", assetsNameMarkersFrom([])));

      it("stands for the spec it belongs to", ({ stem }) => {
        expect(stem).toBe("order");
      });
    });

    describe("a name below a directory", () => {
      const it = test.extend("stem", () =>
        assetsStemOf("src/checks/order.assets.ts", assetsNameMarkersFrom([])));

      it("is read from its last segment alone", ({ stem }) => {
        expect(stem).toBe("order");
      });
    });

    describe("a stem holding separators of its own", () => {
      const it = test.extend("stem", () =>
        assetsStemOf("/repo/owner/vite.config.assets.ts", assetsNameMarkersFrom([])));

      it("stays whole in front of the marker", ({ stem }) => {
        expect(stem).toBe("vite.config");
      });
    });

    describe("a name written as json", () => {
      const it = test.extend("stem", () =>
        assetsStemOf("/repo/owner/order.assets.json", assetsNameMarkersFrom([])));

      it("stands for the spec its stem names", ({ stem }) => {
        expect(stem).toBe("order");
      });
    });

    describe("a name written as yaml", () => {
      const it = test.extend("stem", () =>
        assetsStemOf("/repo/owner/order.assets.yaml", assetsNameMarkersFrom([])));

      it("stands for the spec its stem names", ({ stem }) => {
        expect(stem).toBe("order");
      });
    });

    describe("a name written with backslash separators", () => {
      const it = test.extend("stem", () =>
        assetsStemOf(String.raw`C:\repo\owner\order.assets.ts`, assetsNameMarkersFrom([])));

      it("stands for the same spec", ({ stem }) => {
        expect(stem).toBe("order");
      });
    });

    describe("a name carrying no marker at all", () => {
      const it = test.extend("stem", () =>
        assetsStemOf("/repo/owner/order.ts", assetsNameMarkersFrom([])));

      it("stands for no spec", ({ stem }) => {
        expect(stem).toBe(null);
      });
    });

    describe("a name carrying another marker", () => {
      const it = test.extend("stem", () =>
        assetsStemOf("order.helpers.ts", assetsNameMarkersFrom([])));

      it("stands for no spec", ({ stem }) => {
        expect(stem).toBe(null);
      });
    });

    describe("a directory carrying the marker", () => {
      const it = test.extend("stem", () =>
        assetsStemOf("/repo/owner/order.assets.ts/table.ts", assetsNameMarkersFrom([])));

      it("does not make the names below it stand for a spec", ({ stem }) => {
        expect(stem).toBe(null);
      });
    });

    describe("a name that is the marker and nothing else", () => {
      const it = test.extend("stem", () => assetsStemOf("assets.ts", assetsNameMarkersFrom([])));

      it("stands for no spec", ({ stem }) => {
        expect(stem).toBe(null);
      });
    });

    describe("a name opening with the marker", () => {
      const it = test.extend("stem", () =>
        assetsStemOf("/repo/owner/.assets.ts", assetsNameMarkersFrom([])));

      it("carries no stem in front of it", ({ stem }) => {
        expect(stem).toBe(null);
      });
    });

    describe("a name written without an extension", () => {
      const it = test.extend("stem", () => assetsStemOf("assets", assetsNameMarkersFrom([])));

      it("stands for no spec", ({ stem }) => {
        expect(stem).toBe(null);
      });
    });

    describe("a name that ends at the separator", () => {
      const it = test.extend("stem", () =>
        assetsStemOf("order.assets.", assetsNameMarkersFrom([])));

      it("carries no extension to read", ({ stem }) => {
        expect(stem).toBe(null);
      });
    });
  });

  describe("under a marker that replaces the carried one", () => {
    describe("a name carrying the replacing marker", () => {
      const it = test.extend("stem", () =>
        assetsStemOf(
          "/repo/owner/order.fixtures.ts",
          assetsNameMarkersFrom([{ assetsNameMarkers: ["fixtures"] }]),
        ));

      it("stands for the spec its stem names", ({ stem }) => {
        expect(stem).toBe("order");
      });
    });

    describe("a name carrying the marker that was replaced", () => {
      const it = test.extend("stem", () =>
        assetsStemOf(
          "/repo/owner/order.assets.ts",
          assetsNameMarkersFrom([{ assetsNameMarkers: ["fixtures"] }]),
        ));

      it("stands for no spec", ({ stem }) => {
        expect(stem).toBe(null);
      });
    });
  });

  describe("under a spelled out list of several markers", () => {
    describe("a name carrying the first marker on the list", () => {
      const it = test.extend("stem", () =>
        assetsStemOf(
          "/repo/owner/order.assets.ts",
          assetsNameMarkersFrom([{ assetsNameMarkers: ["assets", "fixtures"] }]),
        ));

      it("stands for its spec", ({ stem }) => {
        expect(stem).toBe("order");
      });
    });

    describe("a name carrying the second marker on the list", () => {
      const it = test.extend("stem", () =>
        assetsStemOf(
          "/repo/owner/order.fixtures.ts",
          assetsNameMarkersFrom([{ assetsNameMarkers: ["assets", "fixtures"] }]),
        ));

      it("stands for its spec", ({ stem }) => {
        expect(stem).toBe("order");
      });
    });
  });
});
