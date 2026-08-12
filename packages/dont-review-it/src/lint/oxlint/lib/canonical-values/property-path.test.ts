import { describe, expect, test } from "vite-plus/test";

import {
  normalizePropertyKey,
  normalizePropertyPath,
  PROPERTY_PATH_WILDCARD,
  propertyPathHasWildcard,
  propertyPathIsPrefixOf,
  propertyPathKey,
  propertyPathsOverlap,
} from "./property-path.ts";

describe("property-path", () => {
  test("numeric and string property keys have the same JavaScript spelling", () => {
    expect(normalizePropertyKey(0)).toBe("0");
    expect(normalizePropertyPath([0, "value"])).toStrictEqual(
      normalizePropertyPath(["0", "value"]),
    );
  });

  test("negative zero has the same JavaScript property spelling as zero", () => {
    expect(normalizePropertyKey(-0)).toBe("0");
  });

  test("normalization preserves a wildcard without colliding with a literal asterisk", () => {
    const wildcardPath = normalizePropertyPath([PROPERTY_PATH_WILDCARD]);
    const asteriskPath = normalizePropertyPath(["*"]);

    expect(propertyPathHasWildcard(wildcardPath)).toBe(true);
    expect(propertyPathHasWildcard(asteriskPath)).toBe(false);
    expect(propertyPathKey(wildcardPath)).not.toBe(propertyPathKey(asteriskPath));
  });

  test("an exact ancestor is a prefix of its descendant", () => {
    expect(
      propertyPathIsPrefixOf(
        normalizePropertyPath(["owner"]),
        normalizePropertyPath(["owner", "values"]),
      ),
    ).toBe(true);
    expect(
      propertyPathIsPrefixOf(
        normalizePropertyPath(["other"]),
        normalizePropertyPath(["owner", "values"]),
      ),
    ).toBe(false);
  });

  test("a wildcard segment is a prefix match for any key at that depth", () => {
    expect(
      propertyPathIsPrefixOf(
        normalizePropertyPath(["owner", PROPERTY_PATH_WILDCARD]),
        normalizePropertyPath(["owner", "values", 0]),
      ),
    ).toBe(true);
  });

  test("paths overlap when either path is a prefix of the other", () => {
    expect(
      propertyPathsOverlap(
        normalizePropertyPath(["owner"]),
        normalizePropertyPath(["owner", "values"]),
      ),
    ).toBe(true);
    expect(
      propertyPathsOverlap(
        normalizePropertyPath(["owner", "values"]),
        normalizePropertyPath(["owner"]),
      ),
    ).toBe(true);
  });

  test("sibling paths do not overlap", () => {
    expect(
      propertyPathsOverlap(
        normalizePropertyPath(["owner", "values"]),
        normalizePropertyPath(["owner", "schema"]),
      ),
    ).toBe(false);
  });

  test("a wildcard write overlaps every sibling at its depth", () => {
    expect(
      propertyPathsOverlap(
        normalizePropertyPath(["owner", PROPERTY_PATH_WILDCARD]),
        normalizePropertyPath(["owner", "values"]),
      ),
    ).toBe(true);
  });
});
