import { describe, expect, test } from "vite-plus/test";

import {
  deadReleasesIn,
  registeredTrackedPathsFrom,
  releasesFrom,
  trackedPathsInForce,
} from "./forbidden-tracked-paths.ts";

const DEFAULT_PATTERNS = ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/.env"];

const patternsOf = (registrations: readonly { readonly pattern: string }[]): readonly string[] =>
  registrations.map((registration) => registration.pattern);

const SELF_RELEASING_OPTIONS = [
  {
    forbidden: [{ pattern: "vendor/**", reason: "the upstream ships no source" }],
    released: [{ pattern: "vendor/**", reason: "the bundle is the shipped artifact" }],
  },
];

describe("forbidden-tracked-paths", () => {
  test("an empty configuration carries the registered defaults", () => {
    expect(patternsOf(registeredTrackedPathsFrom([]))).toStrictEqual(DEFAULT_PATTERNS);
  });

  test("a first option that is not an object carries the registered defaults", () => {
    expect(patternsOf(registeredTrackedPathsFrom([[]]))).toStrictEqual(DEFAULT_PATTERNS);
  });

  test("a forbidden field that is not a list carries the registered defaults", () => {
    expect(patternsOf(registeredTrackedPathsFrom([{ forbidden: "vendor" }]))).toStrictEqual(
      DEFAULT_PATTERNS,
    );
  });

  test("a configured row is added after the defaults", () => {
    expect(
      patternsOf(
        registeredTrackedPathsFrom([
          { forbidden: [{ pattern: "vendor/**", reason: "the upstream ships no source" }] },
        ]),
      ),
    ).toStrictEqual([...DEFAULT_PATTERNS, "vendor/**"]);
  });

  test("rows without a spelled pattern are dropped", () => {
    expect(
      patternsOf(
        registeredTrackedPathsFrom([{ forbidden: [null, 42, { pattern: "   " }, ["vendor"]] }]),
      ),
    ).toStrictEqual(DEFAULT_PATTERNS);
  });

  test("a row keeps its reason, its ignore demand and its exceptions", () => {
    const [registration] = registeredTrackedPathsFrom([
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
    ]).slice(-1);

    expect(registration).toStrictEqual({
      pattern: "vendor/**",
      reason: "the upstream ships no source",
      ignoreListing: false,
      exceptions: [{ pattern: "vendor/keep.js", reason: "shipped" }],
    });
  });

  test("a row naming no exception list and no reason reads as an empty pair", () => {
    const [registration] = registeredTrackedPathsFrom([
      { forbidden: [{ pattern: "vendor/**", reason: 42, exceptions: "vendor/keep.js" }] },
    ]).slice(-1);

    expect(registration).toStrictEqual({
      pattern: "vendor/**",
      reason: "",
      ignoreListing: true,
      exceptions: [],
    });
  });

  test("releases without a spelled pattern are dropped", () => {
    expect(
      releasesFrom([{ released: [null, { pattern: "  " }, { pattern: "**/dist/**" }] }]),
    ).toStrictEqual([{ pattern: "**/dist/**", reason: "" }]);
  });

  test("a release that carries grounds lifts the row it names", () => {
    const registered = registeredTrackedPathsFrom([]);
    const releases = releasesFrom([
      { released: [{ pattern: "**/dist/**", reason: "the build output is the shipped artifact" }] },
    ]);

    expect(patternsOf(trackedPathsInForce({ registered, releases }))).toStrictEqual([
      "**/node_modules/**",
      "**/coverage/**",
      "**/.env",
    ]);
  });

  test("a release that carries no grounds lifts nothing", () => {
    const registered = registeredTrackedPathsFrom([]);
    const releases = releasesFrom([{ released: [{ pattern: "**/dist/**" }] }]);

    expect(patternsOf(trackedPathsInForce({ registered, releases }))).toStrictEqual(
      DEFAULT_PATTERNS,
    );
  });

  test("a release naming a pattern outside the defaults is dead", () => {
    const releases = releasesFrom([
      { released: [{ pattern: "**/nowhere/**", reason: "moved" }, { pattern: "**/dist/**" }] },
    ]);

    expect(deadReleasesIn(releases)).toStrictEqual([{ pattern: "**/nowhere/**", reason: "moved" }]);
  });

  test("a release naming a row this configuration added is dead", () => {
    expect(deadReleasesIn(releasesFrom(SELF_RELEASING_OPTIONS))).toStrictEqual([
      { pattern: "vendor/**", reason: "the bundle is the shipped artifact" },
    ]);
  });

  test("a release naming a row this configuration added lifts nothing", () => {
    const registered = registeredTrackedPathsFrom(SELF_RELEASING_OPTIONS);
    const releases = releasesFrom(SELF_RELEASING_OPTIONS);

    expect(patternsOf(trackedPathsInForce({ registered, releases }))).toStrictEqual([
      ...DEFAULT_PATTERNS,
      "vendor/**",
    ]);
  });
});
