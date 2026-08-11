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
  const records = (): readonly JobRecord[] => [...recordsById.values()];
  return {
    records,
    get: (id) => recordsById.get(id),
    has: (id) => recordsById.has(id),
    put: (record) => {
      recordsById.set(record.id, record);
    },
    remove: (id) => recordsById.delete(id),
    runningCount: () => records().filter((record) => record.state === "running").length,
    waitingCount: () => records().filter((record) => record.state === "waiting").length,
    laneRunning: (lane) =>
      records().some((record) => record.lane === lane && record.state === "running"),
    laneWaiting: (lane) =>
      records().some((record) => record.lane === lane && record.state === "waiting"),
    laneOccupied: (lane) => records().some((record) => record.lane === lane),
    findWaiting: (search) =>
      records().find(
        (record) =>
          record.type === search.type && record.lane === search.lane && record.state === "waiting",
      ),
    hasKey: (key) => records().some((record) => record.key === key),
  };
};
