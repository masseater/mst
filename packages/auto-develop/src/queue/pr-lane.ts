export const prLaneOf = (prNumber: number): string => `pr-${prNumber}`;

export type PrFilter = {
  readonly targetPrs: readonly number[];
  readonly excludedPrs: readonly number[];
};

const PR_LANE_PATTERN = /^pr-([1-9]\d*)$/;

export const prLaneNumber = (lane: string): number | null => {
  const matched = PR_LANE_PATTERN.exec(lane);
  const digits = matched?.[1];
  return digits === undefined ? null : Number(digits);
};

export const laneAdmitted = (admission: {
  readonly lane: string;
  readonly prFilter: PrFilter | undefined;
}): boolean => {
  if (admission.prFilter === undefined) return true;
  const prNumber = prLaneNumber(admission.lane);
  if (prNumber === null) return true;
  if (admission.prFilter.excludedPrs.includes(prNumber)) return false;
  return (
    admission.prFilter.targetPrs.length === 0 || admission.prFilter.targetPrs.includes(prNumber)
  );
};
