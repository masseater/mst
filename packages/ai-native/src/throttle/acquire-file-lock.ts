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

const releaseDescriptor = (request: FileLockRequest, descriptor: number): void => {
  releaseFileLock({ descriptor, unlock: request.unlock, close: request.close });
};

const lockedDescriptor = (request: FileLockRequest): number | null => {
  const descriptor = request.open(request.path);
  const acquired = (() => {
    try {
      return request.tryLock(descriptor);
    } catch (lockFailure) {
      return closeFileDescriptorAfterFailure({
        descriptor,
        precedingFailure: lockFailure,
        close: request.close,
      });
    }
  })();
  if (!acquired) {
    request.close(descriptor);
    return null;
  }
  return descriptor;
};

const releaseAfterGenerationFailure = (input: {
  request: FileLockRequest;
  descriptor: number;
  generationWriteFailure: unknown;
}): never => {
  try {
    releaseDescriptor(input.request, input.descriptor);
  } catch (releaseFailure) {
    throw new AggregateError(
      [input.generationWriteFailure, releaseFailure],
      `Could not record a generation or release file descriptor ${input.descriptor}`,
    );
  }
  throw input.generationWriteFailure;
};

const recordGeneration = (request: FileLockRequest, descriptor: number): void => {
  try {
    request.recordGeneration();
  } catch (generationWriteFailure) {
    releaseAfterGenerationFailure({ request, descriptor, generationWriteFailure });
  }
};

export const tryAcquireFileLock = (
  request: FileLockRequest,
): { release: () => Promise<void> } | null => {
  const descriptor = lockedDescriptor(request);
  if (descriptor === null) return null;
  recordGeneration(request, descriptor);
  return {
    release: once(() =>
      Promise.try(() => {
        releaseDescriptor(request, descriptor);
      }),
    ),
  };
};
