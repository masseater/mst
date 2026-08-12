export type MutatingBuiltinMember = {
  readonly type: string;
  readonly method: string;
  readonly derivation: string;
  readonly sink: boolean;
};

type MemberGroup = {
  readonly type: string;
  readonly methods: readonly string[];
  readonly derivation: string;
};

const MAP_DERIVATION =
  "Build the map you need in one expression: spread the entries of the old one into a new `Map`, or filter those entries before building it.";

const SET_DERIVATION =
  "Build the set you need in one expression: spread the members of the old one into a new `Set`, or filter them before building it.";

const ENTRY_LIST_DERIVATION =
  "Build the whole thing at once from the entries it carries, rather than creating it empty and adding to it.";

const DERIVED_VALUE_GROUPS: readonly MemberGroup[] = [
  { type: "Map", methods: ["clear", "delete", "set"], derivation: MAP_DERIVATION },
  { type: "WeakMap", methods: ["delete", "set"], derivation: MAP_DERIVATION },
  { type: "Set", methods: ["add", "clear", "delete"], derivation: SET_DERIVATION },
  { type: "WeakSet", methods: ["add", "delete"], derivation: SET_DERIVATION },
  {
    type: "Date",
    methods: [
      "setDate",
      "setFullYear",
      "setHours",
      "setMilliseconds",
      "setMinutes",
      "setMonth",
      "setSeconds",
      "setTime",
      "setUTCDate",
      "setUTCFullYear",
      "setUTCHours",
      "setUTCMilliseconds",
      "setUTCMinutes",
      "setUTCMonth",
      "setUTCSeconds",
    ],
    derivation:
      "Build the moment you need as a new `Date` rather than moving an existing one forward.",
  },
  {
    type: "URLSearchParams",
    methods: ["append", "delete", "set", "sort"],
    derivation: ENTRY_LIST_DERIVATION,
  },
  { type: "FormData", methods: ["append", "delete", "set"], derivation: ENTRY_LIST_DERIVATION },
  { type: "Headers", methods: ["append", "delete", "set"], derivation: ENTRY_LIST_DERIVATION },
  {
    type: "DataView",
    methods: [
      "setBigInt64",
      "setBigUint64",
      "setFloat32",
      "setFloat64",
      "setInt16",
      "setInt32",
      "setInt8",
      "setUint16",
      "setUint32",
      "setUint8",
    ],
    derivation:
      "Build the bytes as a new buffer and read them through a fresh view, rather than writing through this one.",
  },
];

const SINK_DERIVATION =
  "A write to a sink leaves the program, so there is no new value to derive here.";

const SINK_GROUPS: readonly MemberGroup[] = [
  {
    type: "WritableStreamDefaultWriter",
    methods: ["abort", "close", "write"],
    derivation: SINK_DERIVATION,
  },
  {
    type: "ReadableStreamDefaultController",
    methods: ["close", "enqueue", "error"],
    derivation: SINK_DERIVATION,
  },
  {
    type: "ReadableByteStreamController",
    methods: ["close", "enqueue", "error"],
    derivation: SINK_DERIVATION,
  },
  {
    type: "TransformStreamDefaultController",
    methods: ["enqueue", "error", "terminate"],
    derivation: SINK_DERIVATION,
  },
];

const memberKeyOf = (member: { readonly type: string; readonly method: string }): string =>
  `${member.type}.${member.method}`;

const membersOf = (
  groups: readonly MemberGroup[],
  sink: boolean,
): readonly MutatingBuiltinMember[] =>
  groups.flatMap(({ type, methods, derivation }) =>
    methods.map((method) => ({ type, method, derivation, sink })),
  );

const MUTATING_BUILTIN_MEMBERS: readonly MutatingBuiltinMember[] = [
  ...membersOf(DERIVED_VALUE_GROUPS, false),
  ...membersOf(SINK_GROUPS, true),
];

const MEMBER_BY_KEY: ReadonlyMap<string, MutatingBuiltinMember> = new Map(
  MUTATING_BUILTIN_MEMBERS.map((member) => [memberKeyOf(member), member]),
);

export const MUTATING_BUILTIN_TYPE_NAMES: ReadonlySet<string> = new Set(
  MUTATING_BUILTIN_MEMBERS.map((member) => member.type),
);

export const MUTATING_BUILTIN_METHOD_NAMES: ReadonlySet<string> = new Set(
  MUTATING_BUILTIN_MEMBERS.map((member) => member.method),
);

export const mutatingBuiltinMemberOf = (member: {
  readonly type: string;
  readonly method: string;
}): MutatingBuiltinMember | null => MEMBER_BY_KEY.get(memberKeyOf(member)) ?? null;
