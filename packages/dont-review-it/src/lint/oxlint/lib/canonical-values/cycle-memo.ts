import { propertyPathKey, type PropertyPath } from "./property-path.ts";

export type CycleMemoKey<Identity extends object, Domain, ExecutionContext> = {
  readonly cutoff: number;
  readonly domain: Domain;
  readonly executionContext: ExecutionContext;
  readonly identity: Identity;
  readonly path: PropertyPath;
};

export type CycleMemo<Result, Identity extends object, Domain, ExecutionContext> = {
  readonly enter: (key: CycleMemoKey<Identity, Domain, ExecutionContext>) =>
    | { readonly kind: "cycle" }
    | { readonly kind: "cached"; readonly value: Result }
    | {
        readonly abandon: () => void;
        readonly complete: (value: Result) => void;
        readonly kind: "entered";
      };
};

type EntriesByCutoff<Result> = Map<
  number,
  { readonly state: "active" } | { readonly state: "complete"; readonly value: Result }
>;

type EntriesByPath<Result> = Map<string, EntriesByCutoff<Result>>;

type EntriesByExecutionContext<ExecutionContext, Result> = Map<
  ExecutionContext,
  EntriesByPath<Result>
>;

type EntriesByDomain<Domain, ExecutionContext, Result> = Map<
  Domain,
  EntriesByExecutionContext<ExecutionContext, Result>
>;

const valueOrCreate = <Key, Value>(
  store: {
    readonly get: (key: Key) => Value | undefined;
    readonly set: (key: Key, stored: Value) => unknown;
  },
  options: { readonly createValue: () => Value; readonly key: Key },
): Value => {
  const existing = store.get(options.key);
  if (existing !== undefined) return existing;
  const created = options.createValue();
  store.set(options.key, created);
  return created;
};

export const createCycleMemo = <
  Result,
  Identity extends object = object,
  Domain = string,
  ExecutionContext = string,
>(): CycleMemo<Result, Identity, Domain, ExecutionContext> => {
  const entriesByIdentity = new WeakMap<
    Identity,
    EntriesByDomain<Domain, ExecutionContext, Result>
  >();

  return {
    enter(key) {
      const entriesByDomain = valueOrCreate(entriesByIdentity, {
        key: key.identity,
        createValue: (): EntriesByDomain<Domain, ExecutionContext, Result> => new Map(),
      });
      const entriesByExecutionContext = valueOrCreate(entriesByDomain, {
        key: key.domain,
        createValue: (): EntriesByExecutionContext<ExecutionContext, Result> => new Map(),
      });
      const entriesByPath = valueOrCreate(entriesByExecutionContext, {
        key: key.executionContext,
        createValue: (): EntriesByPath<Result> => new Map(),
      });
      const entriesByCutoff = valueOrCreate(entriesByPath, {
        key: propertyPathKey(key.path),
        createValue: (): EntriesByCutoff<Result> => new Map(),
      });
      const existing = entriesByCutoff.get(key.cutoff);
      if (existing?.state === "active") return { kind: "cycle" };
      if (existing?.state === "complete") return { kind: "cached", value: existing.value };

      const activeEntry = { state: "active" } as const;
      entriesByCutoff.set(key.cutoff, activeEntry);
      return {
        kind: "entered",
        complete(value) {
          if (entriesByCutoff.get(key.cutoff) === activeEntry) {
            entriesByCutoff.set(key.cutoff, { state: "complete", value });
          }
        },
        abandon() {
          if (entriesByCutoff.get(key.cutoff) === activeEntry) {
            entriesByCutoff.delete(key.cutoff);
          }
        },
      };
    },
  };
};
