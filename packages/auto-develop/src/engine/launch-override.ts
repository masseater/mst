export type LaunchOverride = {
  readonly binary: string;
  readonly prefixArgs: readonly string[];
};

export const parseLaunchOverride = (override: string | undefined): LaunchOverride | null => {
  if (override === undefined) return null;
  const tokens = override
    .trim()
    .split(/\s+/)
    .filter((token) => token !== "");
  const [binary, ...prefixArgs] = tokens;
  if (binary === undefined) return null;
  return { binary, prefixArgs };
};
