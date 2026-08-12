export const recordOf = (declared: unknown): Readonly<Record<string, unknown>> =>
  declared !== null && typeof declared === "object" && !Array.isArray(declared)
    ? (declared as Record<string, unknown>)
    : {};

export const stringEntriesOf = (declared: unknown): readonly (readonly [string, string])[] =>
  Object.entries(recordOf(declared)).filter(
    (listed): listed is [string, string] => typeof listed[1] === "string",
  );
