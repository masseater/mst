export const readEnvVar = (
  spelled: string,
  env: Readonly<Record<string, unknown>> = process.env,
): string | undefined => {
  const declaredValue = env[spelled];
  if (declaredValue === undefined || declaredValue === "") return undefined;
  if (typeof declaredValue !== "string")
    throw new TypeError(`${spelled} must be a string when set`);
  return declaredValue;
};
