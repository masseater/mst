export type Command = [string, ...string[]];

export const parseCommand = (argv: string[]): Command | undefined => {
  if (argv[0] !== "--") {
    return undefined;
  }
  const [head, ...rest] = argv.slice(1);
  if (head === undefined) {
    return undefined;
  }
  return [head, ...rest];
};
