import { describe, expect, test } from "vite-plus/test";

import {
  deadReleasesIn,
  registeredTrackedPathsFrom,
  releasesFrom,
  trackedPathsInForce,
} from "./forbidden-tracked-paths.ts";

const DEFAULT_PATTERNS = ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/.env"];

const SELF_RELEASING_OPTIONS = [
  {
    forbidden: [{ pattern: "vendor/**", reason: "the upstream ships no source" }],
    released: [{ pattern: "vendor/**", reason: "the bundle is the shipped artifact" }],
  },
];

const it = test
  .extend("patternsRegisteredWithoutOptions", () =>
    registeredTrackedPathsFrom([]).map((registration) => registration.pattern))
  .extend("patternsRegisteredFromNonRecordOptions", () =>
    registeredTrackedPathsFrom([[]]).map((registration) => registration.pattern),
  )
  .extend("patternsRegisteredFromUnlistedForbidden", () =>
    registeredTrackedPathsFrom([{ forbidden: "vendor" }]).map(
      (registration) => registration.pattern,
    ),
  )
  .extend("patternsRegisteredFromOneConfiguredRow", () =>
    registeredTrackedPathsFrom([
      { forbidden: [{ pattern: "vendor/**", reason: "the upstream ships no source" }] },
    ]).map((registration) => registration.pattern),
  )
  .extend("patternsRegisteredFromUnspelledRows", () =>
    registeredTrackedPathsFrom([{ forbidden: [null, 42, { pattern: "   " }, ["vendor"]] }]).map(
      (registration) => registration.pattern,
    ),
  )
  .extend("registrationCarryingEveryField", () =>
    registeredTrackedPathsFrom([
      {
        forbidden: [
          {
            pattern: "vendor/**",
            reason: "  the upstream ships no source  ",
            ignoreListing: false,
            exceptions: [null, { pattern: "" }, { pattern: "vendor/keep.js", reason: " shipped " }],
          },
        ],
      },
    ]).slice(-1),
  )
  .extend("registrationCarryingNoReadableField", () =>
    registeredTrackedPathsFrom([
      { forbidden: [{ pattern: "vendor/**", reason: 42, exceptions: "vendor/keep.js" }] },
    ]).slice(-1),
  )
  .extend("releasesFromUnspelledRows", () =>
    releasesFrom([{ released: [null, { pattern: "  " }, { pattern: "**/dist/**" }] }]),
  )
  .extend("patternsLeftByAReleaseCarryingGrounds", () =>
    trackedPathsInForce({
      registered: registeredTrackedPathsFrom([]),
      releases: releasesFrom([
        {
          released: [{ pattern: "**/dist/**", reason: "the build output is the shipped artifact" }],
        },
      ]),
    }).map((registration) => registration.pattern),
  )
  .extend("patternsLeftByAReleaseCarryingNoGrounds", () =>
    trackedPathsInForce({
      registered: registeredTrackedPathsFrom([]),
      releases: releasesFrom([{ released: [{ pattern: "**/dist/**" }] }]),
    }).map((registration) => registration.pattern),
  )
  .extend("deadReleasesNamingAPatternOutsideTheDefaults", () =>
    deadReleasesIn(
      releasesFrom([
        { released: [{ pattern: "**/nowhere/**", reason: "moved" }, { pattern: "**/dist/**" }] },
      ]),
    ),
  )
  .extend("deadReleasesNamingARowThisConfigurationAdded", () =>
    deadReleasesIn(releasesFrom(SELF_RELEASING_OPTIONS)),
  )
  .extend("patternsLeftByASelfReleasingConfiguration", () =>
    trackedPathsInForce({
      registered: registeredTrackedPathsFrom(SELF_RELEASING_OPTIONS),
      releases: releasesFrom(SELF_RELEASING_OPTIONS),
    }).map((registration) => registration.pattern),
  );

describe("forbidden-tracked-paths", () => {
  it("an empty configuration carries the registered defaults", ({
    patternsRegisteredWithoutOptions,
  }) => {
    expect(patternsRegisteredWithoutOptions).toStrictEqual(DEFAULT_PATTERNS);
  });

  it("a first option that is not an object carries the registered defaults", ({
    patternsRegisteredFromNonRecordOptions,
  }) => {
    expect(patternsRegisteredFromNonRecordOptions).toStrictEqual(DEFAULT_PATTERNS);
  });

  it("a forbidden field that is not a list carries the registered defaults", ({
    patternsRegisteredFromUnlistedForbidden,
  }) => {
    expect(patternsRegisteredFromUnlistedForbidden).toStrictEqual(DEFAULT_PATTERNS);
  });

  it("a configured row is added after the defaults", ({
    patternsRegisteredFromOneConfiguredRow,
  }) => {
    expect(patternsRegisteredFromOneConfiguredRow).toStrictEqual([
      ...DEFAULT_PATTERNS,
      "vendor/**",
    ]);
  });

  it("rows without a spelled pattern are dropped", ({ patternsRegisteredFromUnspelledRows }) => {
    expect(patternsRegisteredFromUnspelledRows).toStrictEqual(DEFAULT_PATTERNS);
  });

  it("a row keeps its reason, its ignore demand and its exceptions", ({
    registrationCarryingEveryField,
  }) => {
    expect(registrationCarryingEveryField).toStrictEqual([
      {
        pattern: "vendor/**",
        reason: "the upstream ships no source",
        ignoreListing: false,
        exceptions: [{ pattern: "vendor/keep.js", reason: "shipped" }],
      },
    ]);
  });

  it("a row naming no exception list and no reason reads as an empty pair", ({
    registrationCarryingNoReadableField,
  }) => {
    expect(registrationCarryingNoReadableField).toStrictEqual([
      { pattern: "vendor/**", reason: "", ignoreListing: true, exceptions: [] },
    ]);
  });

  it("releases without a spelled pattern are dropped", ({ releasesFromUnspelledRows }) => {
    expect(releasesFromUnspelledRows).toStrictEqual([{ pattern: "**/dist/**", reason: "" }]);
  });

  it("a release that carries grounds lifts the row it names", ({
    patternsLeftByAReleaseCarryingGrounds,
  }) => {
    expect(patternsLeftByAReleaseCarryingGrounds).toStrictEqual([
      "**/node_modules/**",
      "**/coverage/**",
      "**/.env",
    ]);
  });

  it("a release that carries no grounds lifts nothing", ({
    patternsLeftByAReleaseCarryingNoGrounds,
  }) => {
    expect(patternsLeftByAReleaseCarryingNoGrounds).toStrictEqual(DEFAULT_PATTERNS);
  });

  it("a release naming a pattern outside the defaults is dead", ({
    deadReleasesNamingAPatternOutsideTheDefaults,
  }) => {
    expect(deadReleasesNamingAPatternOutsideTheDefaults).toStrictEqual([
      { pattern: "**/nowhere/**", reason: "moved" },
    ]);
  });

  it("a release naming a row this configuration added is dead", ({
    deadReleasesNamingARowThisConfigurationAdded,
  }) => {
    expect(deadReleasesNamingARowThisConfigurationAdded).toStrictEqual([
      { pattern: "vendor/**", reason: "the bundle is the shipped artifact" },
    ]);
  });

  it("a release naming a row this configuration added lifts nothing", ({
    patternsLeftByASelfReleasingConfiguration,
  }) => {
    expect(patternsLeftByASelfReleasingConfiguration).toStrictEqual([
      ...DEFAULT_PATTERNS,
      "vendor/**",
    ]);
  });
});
