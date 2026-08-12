const attemptOperation = (
  operation: () => void,
): { kind: "completed" } | { kind: "failed"; failure: unknown } => {
  try {
    operation();
    return { kind: "completed" };
  } catch (operationFailure) {
    return { kind: "failed", failure: operationFailure };
  }
};

export const closeFileDescriptorAfterFailure = (input: {
  descriptor: number;
  precedingFailure: unknown;
  close: (descriptor: number) => void;
}): never => {
  const closeAttempt = attemptOperation(() => {
    input.close(input.descriptor);
  });
  if (closeAttempt.kind === "failed") {
    throw new AggregateError(
      [input.precedingFailure, closeAttempt.failure],
      `Operation and close both failed for file descriptor ${input.descriptor}`,
    );
  }
  throw input.precedingFailure;
};

export const releaseFileLock = (input: {
  descriptor: number;
  unlock: (descriptor: number) => void;
  close: (descriptor: number) => void;
}): void => {
  const unlockAttempt = attemptOperation(() => {
    input.unlock(input.descriptor);
  });
  const closeAttempt = attemptOperation(() => {
    input.close(input.descriptor);
  });
  if (unlockAttempt.kind === "failed" && closeAttempt.kind === "failed") {
    throw new AggregateError(
      [unlockAttempt.failure, closeAttempt.failure],
      `Could not unlock and close file descriptor ${input.descriptor}`,
    );
  }
  if (unlockAttempt.kind === "failed") throw unlockAttempt.failure;
  if (closeAttempt.kind === "failed") throw closeAttempt.failure;
};
