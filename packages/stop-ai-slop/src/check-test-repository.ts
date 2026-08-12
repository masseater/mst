import { runStopAiSlop } from "./run-cli.ts";

import type { TestRepository } from "./test-repository.ts";

export const checkTestRepository = ({
  repository,
  base,
  head,
}: {
  readonly repository: TestRepository;
  readonly base: string;
  readonly head: string;
}) =>
  runStopAiSlop(["check", "--repository-root", repository.root, "--base", base, "--head", head]);
