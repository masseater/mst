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

class RecordedJobs implements JobLedger {
  #recordsById: ReadonlyMap<string, JobRecord> = new Map();

  records(): readonly JobRecord[] {
    return [...this.#recordsById.values()];
  }

  get(identity: string): JobRecord | undefined {
    return this.#recordsById.get(identity);
  }

  has(identity: string): boolean {
    return this.#recordsById.has(identity);
  }

  put(written: JobRecord): void {
    this.#recordsById = new Map<string, JobRecord>([...this.#recordsById, [written.id, written]]);
  }

  remove(identity: string): boolean {
    if (!this.#recordsById.has(identity)) return false;
    this.#recordsById = new Map<string, JobRecord>(
      [...this.#recordsById].filter(([heldId]) => heldId !== identity),
    );
    return true;
  }

  runningCount(): number {
    return this.records().filter((written) => written.state === "running").length;
  }

  waitingCount(): number {
    return this.records().filter((written) => written.state === "waiting").length;
  }

  laneRunning(lane: string): boolean {
    return this.records().some((written) => written.lane === lane && written.state === "running");
  }

  laneWaiting(lane: string): boolean {
    return this.records().some((written) => written.lane === lane && written.state === "waiting");
  }

  laneOccupied(lane: string): boolean {
    return this.records().some((written) => written.lane === lane);
  }

  findWaiting(search: { readonly type: string; readonly lane: string }): JobRecord | undefined {
    return this.records().find(
      (written) =>
        written.type === search.type && written.lane === search.lane && written.state === "waiting",
    );
  }

  hasKey(named: string): boolean {
    return this.records().some((written) => written.key === named);
  }
}

export const createJobLedger = (): JobLedger => new RecordedJobs();
