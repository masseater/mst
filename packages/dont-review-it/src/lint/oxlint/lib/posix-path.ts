export const toPosixPath = (path: string): string => path.split(/[\\/]/u).join("/");
