export const extractBearer = (authorizationHeader: string | undefined): string | undefined => {
  if (authorizationHeader === undefined) return undefined;
  const spaceIndex = authorizationHeader.indexOf(" ");
  if (spaceIndex === -1) return undefined;
  const scheme = authorizationHeader.slice(0, spaceIndex);
  if (scheme.toLowerCase() !== "bearer") return undefined;
  return authorizationHeader.slice(spaceIndex + 1);
};
