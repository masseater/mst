import { once } from "es-toolkit/function";

import { closeFileDescriptorAfterFailure, releaseFileLock } from "./release-file-lock.ts";

type FileLockRequest = {
  path: string;
  open: (path: string) => number;
  tryLock: (descriptor: number) => boolean;
  unlock: (descriptor: number) => void;
  close: (descriptor: number) => void;
  recordGeneration: () => void;
};

const releaseDescriptor = (fileLock: FileLockRequest, descriptor: number): void => {
  releaseFileLock({ descriptor, unlock: fileLock.unlock, close: fileLock.close });
};

const lockedDescriptor = (fileLock: FileLockRequest): number | null => {
  const descriptor = fileLock.open(fileLock.path);
  const acquired = (() => {
    try {
      return fileLock.tryLock(descriptor);
    } catch (lockFailure) {
      return closeFileDescriptorAfterFailure({
        descriptor,
        precedingFailure: lockFailure,
        close: fileLock.close,
      });
    }
  })();
  if (!acquired) {
    fileLock.close(descriptor);
    return null;
  }
  return descriptor;
};

const releaseAfterGenerationFailure = (input: {
  fileLock: FileLockRequest;
  descriptor: number;
  generationWriteFailure: unknown;
}): never => {
  try {
    releaseDescriptor(input.fileLock, input.descriptor);
  } catch (releaseFailure) {
    throw new AggregateError(
      [input.generationWriteFailure, releaseFailure],
      `Could not record a generation or release file descriptor ${input.descriptor}`,
    );
  }
  throw input.generationWriteFailure;
};

const recordGeneration = (fileLock: FileLockRequest, descriptor: number): void => {
  try {
    fileLock.recordGeneration();
  } catch (generationWriteFailure) {
    releaseAfterGenerationFailure({ fileLock, descriptor, generationWriteFailure });
  }
};

export const tryAcquireFileLock = (
  fileLock: FileLockRequest,
): { release: () => Promise<void> } | null => {
  const descriptor = lockedDescriptor(fileLock);
  if (descriptor === null) return null;
  recordGeneration(fileLock, descriptor);
  return {
    release: once(() =>
      Promise.try(() => {
        releaseDescriptor(fileLock, descriptor);
      }),
    ),
  };
};
