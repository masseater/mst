import type { Logger } from "../logging/logger.ts";

/** @canonical-values auto-develop.shutdown-signal */
export const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;

export type ShutdownSignal = (typeof SHUTDOWN_SIGNALS)[number];

export type SignalTarget = {
  readonly on: (signal: ShutdownSignal, listener: () => void) => void;
  readonly off: (signal: ShutdownSignal, listener: () => void) => void;
};

export type ShutdownRegistration = {
  readonly release: () => void;
};

export const registerShutdown = (registration: {
  readonly target: SignalTarget;
  readonly onSignal: (signal: ShutdownSignal) => void;
  readonly log: Logger;
}): ShutdownRegistration => {
  const listeners = new Map<ShutdownSignal, () => void>(
    SHUTDOWN_SIGNALS.map((signal) => [
      signal,
      (): void => {
        registration.log.info({ signal }, "shutdown signal received");
        registration.onSignal(signal);
      },
    ]),
  );
  for (const [signal, listener] of listeners) registration.target.on(signal, listener);
  return {
    release: () => {
      for (const [signal, listener] of listeners) registration.target.off(signal, listener);
    },
  };
};
