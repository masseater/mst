export type CliResult = {
  readonly exitCode: number;
  readonly out: string;
  readonly error: string;
};

export const EXIT_SUCCESS = 0;

export const EXIT_PROBLEMS_FOUND = 1;

export const EXIT_MISUSE = 2;
