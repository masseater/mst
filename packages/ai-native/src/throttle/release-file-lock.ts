import { attempt } from "es-toolkit";

export const closeFileDescriptorAfterFailure = (input: {
  descriptor: number;
  precedingFailure: unknown;
  close: (descriptor: number) => void;
}): never => {
  const [closeFailure] = attempt<true, Error>(() => {
    input.close(input.descriptor);
    return true;
  });
  if (closeFailure !== null) {
    throw new AggregateError(
      [input.precedingFailure, closeFailure],
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
  const [unlockFailure] = attempt<true, Error>(() => {
    input.unlock(input.descriptor);
    return true;
  });
  const [closeFailure] = attempt<true, Error>(() => {
    input.close(input.descriptor);
    return true;
  });
  if (unlockFailure !== null && closeFailure !== null) {
    throw new AggregateError(
      [unlockFailure, closeFailure],
      `Could not unlock and close file descriptor ${input.descriptor}`,
    );
  }
  if (unlockFailure !== null) throw unlockFailure;
  if (closeFailure !== null) throw closeFailure;
};
