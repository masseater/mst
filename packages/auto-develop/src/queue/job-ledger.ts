export type JobRecord = {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly key: string;
  readonly lane: string;
  readonly label: string;
  readonly state: "waiting" | "running";
  readonly acceptedAt: string;
};

export type JobLedger = {
  readonly records: () => readonly JobRecord[];
  readonly get: (id: string) => JobRecord | undefined;
  readonly has: (id: string) => boolean;
  readonly put: (record: JobRecord) => void;
  readonly remove: (id: string) => boolean;
  readonly runningCount: () => number;
  readonly waitingCount: () => number;
  readonly laneRunning: (lane: string) => boolean;
  readonly laneWaiting: (lane: string) => boolean;
  readonly laneOccupied: (lane: string) => boolean;
  readonly findWaiting: (search: {
    readonly type: string;
    readonly lane: string;
  }) => JobRecord | undefined;
  readonly hasKey: (key: string) => boolean;
};

export const createJobLedger = (): JobLedger => {
  const recordsById = new Map<string, JobRecord>();
  const writtenRecords = (): readonly JobRecord[] => [...recordsById.values()];
  return {
    records: writtenRecords,
    get: (identity) => recordsById.get(identity),
    has: (identity) => recordsById.has(identity),
    put: (written) => {
      recordsById.set(written.id, written);
    },
    remove: (identity) => recordsById.delete(identity),
    runningCount: () => writtenRecords().filter((written) => written.state === "running").length,
    waitingCount: () => writtenRecords().filter((written) => written.state === "waiting").length,
    laneRunning: (lane) =>
      writtenRecords().some((written) => written.lane === lane && written.state === "running"),
    laneWaiting: (lane) =>
      writtenRecords().some((written) => written.lane === lane && written.state === "waiting"),
    laneOccupied: (lane) => writtenRecords().some((written) => written.lane === lane),
    findWaiting: (search) =>
      writtenRecords().find(
        (written) =>
          written.type === search.type &&
          written.lane === search.lane &&
          written.state === "waiting",
      ),
    hasKey: (named) => writtenRecords().some((written) => written.key === named),
  };
};
