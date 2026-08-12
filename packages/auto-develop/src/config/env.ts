export const readEnvVar = (
  name: string,
  env: Readonly<Record<string, unknown>> = process.env,
): string | undefined => {
  const rawEntry = env[name];
  if (rawEntry === undefined || rawEntry === "") return undefined;
  if (typeof rawEntry !== "string") throw new TypeError(`${name} must be a string when set`);
  return rawEntry;
};
