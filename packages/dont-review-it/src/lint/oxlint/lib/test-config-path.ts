import { toPosixPath } from "./posix-path.ts";

const TEST_CONFIG_PATH = /(?:^|\/)vite(?:st)?\.config\.[cm]?[jt]s$/u;

export const isTestConfigPath = (filename: string): boolean =>
  TEST_CONFIG_PATH.test(toPosixPath(filename));
