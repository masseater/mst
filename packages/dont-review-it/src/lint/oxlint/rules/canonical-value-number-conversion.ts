export const canonicalValueIntegerOrInfinity = (value: number): number => {
  if (Number.isNaN(value) || value === 0) return 0;
  return Number.isFinite(value) ? Math.trunc(value) : value;
};
