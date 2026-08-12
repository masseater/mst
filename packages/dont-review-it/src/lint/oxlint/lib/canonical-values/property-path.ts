export const PROPERTY_PATH_WILDCARD: unique symbol = Symbol("property-path-wildcard");

export type PropertyPathSegment = string | typeof PROPERTY_PATH_WILDCARD;

export type PropertyPath = readonly PropertyPathSegment[];

export type PropertyPathInput = string | number | typeof PROPERTY_PATH_WILDCARD;

export const normalizePropertyKey = (propertyKey: string | number): string => String(propertyKey);

export const normalizePropertyPath = (segments: readonly PropertyPathInput[]): PropertyPath =>
  segments.map((segment) =>
    segment === PROPERTY_PATH_WILDCARD ? PROPERTY_PATH_WILDCARD : normalizePropertyKey(segment),
  );

const propertyPathSegmentsOverlap = (
  left: PropertyPathSegment,
  right: PropertyPathSegment,
): boolean => left === PROPERTY_PATH_WILDCARD || right === PROPERTY_PATH_WILDCARD || left === right;

export const propertyPathIsPrefixOf = (prefix: PropertyPath, path: PropertyPath): boolean =>
  prefix.length <= path.length &&
  prefix.every((prefixSegment, index) => {
    const pathSegment = path[index];
    return pathSegment !== undefined && propertyPathSegmentsOverlap(prefixSegment, pathSegment);
  });

export const propertyPathsOverlap = (left: PropertyPath, right: PropertyPath): boolean =>
  propertyPathIsPrefixOf(left, right) || propertyPathIsPrefixOf(right, left);

export const propertyPathsEqual = (left: PropertyPath, right: PropertyPath): boolean =>
  left.length === right.length && left.every((segment, index) => segment === right[index]);

export const propertyPathHasWildcard = (path: PropertyPath): boolean =>
  path.includes(PROPERTY_PATH_WILDCARD);

export const propertyPathKey = (path: PropertyPath): string =>
  JSON.stringify(
    path.map((segment) => (segment === PROPERTY_PATH_WILDCARD ? ["wildcard"] : ["key", segment])),
  );
