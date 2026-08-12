export const pluralized = ({
  count,
  noun,
}: {
  readonly count: number;
  readonly noun: string;
}): string => (count === 1 ? noun : `${noun}s`);

export const counted = ({
  count,
  noun,
}: {
  readonly count: number;
  readonly noun: string;
}): string => `${count} ${pluralized({ count, noun })}`;
