export const readEnvVar = (
  name: string,
  env: Readonly<Record<string, unknown>> = process.env,
): string | undefined => {
  const rawEntry = env[name];
  if (rawEntry === undefined || rawEntry === "") return undefined;
  if (typeof rawEntry !== "string") throw new TypeError(`${name} must be a string when set`);
  return rawEntry;
};

export const wholeEnv = (): Readonly<Record<string, string | undefined>> => process.env;

export const isCiEnvironment = (env: Readonly<Record<string, unknown>> = process.env): boolean =>
  env.CI === "true";
