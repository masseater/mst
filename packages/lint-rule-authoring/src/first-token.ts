export const firstToken = (text: string): string => {
  const trimmed = text.trim();
  return trimmed.length === 0 ? "" : trimmed.split(/\s+/u, 1)[0];
};
