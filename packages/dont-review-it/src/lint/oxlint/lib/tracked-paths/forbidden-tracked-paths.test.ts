import { describe, expect, test } from "vite-plus/test";

import {
  deadReleasesIn,
  registeredTrackedPathsFrom,
  releasesFrom,
  trackedPathsInForce,
} from "./forbidden-tracked-paths.ts";

describe("registeredTrackedPathsFrom", () => {
  describe("an empty configuration", () => {
    const it = test.extend("registeredPatterns", () =>
      registeredTrackedPathsFrom([]).map((registration) => registration.pattern));

    it("carries the registered defaults", ({ registeredPatterns }) => {
      expect(registeredPatterns).toStrictEqual([
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/.env",
      ]);
    });
  });

  describe("a first option that is not an object", () => {
    const it = test.extend("registeredPatterns", () =>
      registeredTrackedPathsFrom([[]]).map((registration) => registration.pattern));

    it("carries the registered defaults", ({ registeredPatterns }) => {
      expect(registeredPatterns).toStrictEqual([
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/.env",
      ]);
    });
  });

  describe("a forbidden field that is not a list", () => {
    const it = test.extend("registeredPatterns", () =>
      registeredTrackedPathsFrom([{ forbidden: "vendor" }]).map(
        (registration) => registration.pattern,
      ));

    it("carries the registered defaults", ({ registeredPatterns }) => {
      expect(registeredPatterns).toStrictEqual([
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/.env",
      ]);
    });
  });

  describe("a configuration holding one spelled row", () => {
    const it = test.extend("registeredPatterns", () =>
      registeredTrackedPathsFrom([
        { forbidden: [{ pattern: "vendor/**", reason: "the upstream ships no source" }] },
      ]).map((registration) => registration.pattern));

    it("adds that row after the defaults", ({ registeredPatterns }) => {
      expect(registeredPatterns).toStrictEqual([
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/.env",
        "vendor/**",
      ]);
    });
  });

  describe("rows carrying no spelled pattern", () => {
    const it = test.extend("registeredPatterns", () =>
      registeredTrackedPathsFrom([{ forbidden: [null, 42, { pattern: "   " }, ["vendor"]] }]).map(
        (registration) => registration.pattern,
      ));

    it("are dropped", ({ registeredPatterns }) => {
      expect(registeredPatterns).toStrictEqual([
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/.env",
      ]);
    });
  });

  describe("a row carrying a reason, an ignore demand and exceptions", () => {
    const it = test.extend("registrationsAfterTheDefaults", () =>
      registeredTrackedPathsFrom([
        {
          forbidden: [
            {
              pattern: "vendor/**",
              reason: "  the upstream ships no source  ",
              ignoreListing: false,
              exceptions: [
                null,
                { pattern: "" },
                { pattern: "vendor/keep.js", reason: " shipped " },
              ],
            },
          ],
        },
      ]).slice(-1));

    it("keeps its reason, its ignore demand and its spelled exceptions", ({
      registrationsAfterTheDefaults,
    }) => {
      expect(registrationsAfterTheDefaults).toStrictEqual([
        {
          pattern: "vendor/**",
          reason: "the upstream ships no source",
          ignoreListing: false,
          exceptions: [{ pattern: "vendor/keep.js", reason: "shipped" }],
        },
      ]);
    });
  });

  describe("a row naming no readable reason and no exception list", () => {
    const it = test.extend("registrationsAfterTheDefaults", () =>
      registeredTrackedPathsFrom([
        { forbidden: [{ pattern: "vendor/**", reason: 42, exceptions: "vendor/keep.js" }] },
      ]).slice(-1));

    it("reads as an empty pair that demands the listing", ({ registrationsAfterTheDefaults }) => {
      expect(registrationsAfterTheDefaults).toStrictEqual([
        { pattern: "vendor/**", reason: "", ignoreListing: true, exceptions: [] },
      ]);
    });
  });
});

describe("releasesFrom", () => {
  describe("releases carrying no spelled pattern", () => {
    const it = test.extend("releases", () =>
      releasesFrom([{ released: [null, { pattern: "  " }, { pattern: "**/dist/**" }] }]));

    it("are dropped", ({ releases }) => {
      expect(releases).toStrictEqual([{ pattern: "**/dist/**", reason: "" }]);
    });
  });
});

describe("trackedPathsInForce", () => {
  describe("a release that carries grounds", () => {
    const it = test.extend("patternsInForce", () =>
      trackedPathsInForce({
        registered: registeredTrackedPathsFrom([]),
        releases: releasesFrom([
          {
            released: [
              { pattern: "**/dist/**", reason: "the build output is the shipped artifact" },
            ],
          },
        ]),
      }).map((registration) => registration.pattern));

    it("lifts the row it names", ({ patternsInForce }) => {
      expect(patternsInForce).toStrictEqual(["**/node_modules/**", "**/coverage/**", "**/.env"]);
    });
  });

  describe("a release that carries no grounds", () => {
    const it = test.extend("patternsInForce", () =>
      trackedPathsInForce({
        registered: registeredTrackedPathsFrom([]),
        releases: releasesFrom([{ released: [{ pattern: "**/dist/**" }] }]),
      }).map((registration) => registration.pattern));

    it("lifts nothing", ({ patternsInForce }) => {
      expect(patternsInForce).toStrictEqual([
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/.env",
      ]);
    });
  });

  describe("a release naming a row this configuration added", () => {
    const it = test.extend("patternsInForce", () =>
      trackedPathsInForce({
        registered: registeredTrackedPathsFrom([
          {
            forbidden: [{ pattern: "vendor/**", reason: "the upstream ships no source" }],
            released: [{ pattern: "vendor/**", reason: "the bundle is the shipped artifact" }],
          },
        ]),
        releases: releasesFrom([
          {
            forbidden: [{ pattern: "vendor/**", reason: "the upstream ships no source" }],
            released: [{ pattern: "vendor/**", reason: "the bundle is the shipped artifact" }],
          },
        ]),
      }).map((registration) => registration.pattern));

    it("lifts nothing", ({ patternsInForce }) => {
      expect(patternsInForce).toStrictEqual([
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/.env",
        "vendor/**",
      ]);
    });
  });
});

describe("deadReleasesIn", () => {
  describe("a release naming a pattern outside the defaults", () => {
    const it = test.extend("deadReleases", () =>
      deadReleasesIn(
        releasesFrom([
          { released: [{ pattern: "**/nowhere/**", reason: "moved" }, { pattern: "**/dist/**" }] },
        ]),
      ));

    it("is dead", ({ deadReleases }) => {
      expect(deadReleases).toStrictEqual([{ pattern: "**/nowhere/**", reason: "moved" }]);
    });
  });

  describe("a release naming a row this configuration added", () => {
    const it = test.extend("deadReleases", () =>
      deadReleasesIn(
        releasesFrom([
          {
            forbidden: [{ pattern: "vendor/**", reason: "the upstream ships no source" }],
            released: [{ pattern: "vendor/**", reason: "the bundle is the shipped artifact" }],
          },
        ]),
      ));

    it("is dead", ({ deadReleases }) => {
      expect(deadReleases).toStrictEqual([
        { pattern: "vendor/**", reason: "the bundle is the shipped artifact" },
      ]);
    });
  });
});
