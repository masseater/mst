export const warnUnreleased = (failure: Error): void => {
  process.stderr.write(`throttle: ${failure.message}\n`);
};
