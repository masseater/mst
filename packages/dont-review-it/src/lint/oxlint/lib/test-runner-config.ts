import { toPosixPath } from "./posix-path.ts";

const TEST_RUNNER_CONFIG_PATH = /(?:^|\/)vite(?:st)?\.config\.[cm]?[jt]s$/u;

export const isTestRunnerConfig = (filename: string): boolean =>
  TEST_RUNNER_CONFIG_PATH.test(toPosixPath(filename));
