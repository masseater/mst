export const firstToken = (text: string): string => text.trim().split(/\s+/u, 1)[0] ?? "";
