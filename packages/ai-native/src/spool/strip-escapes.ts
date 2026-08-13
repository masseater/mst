import { once } from "node:events";
import { Duplex, PassThrough } from "node:stream";

const ESC = 0x1b;
const BEL = 0x07;

type StripStep = { state: StripState; emitted: string };
type StripState = { consume: (byte: number) => StripStep };

const ground: StripState = {
  consume: (byte) =>
    byte === ESC
      ? { state: escapeLead, emitted: "" }
      : { state: ground, emitted: String.fromCharCode(byte) },
};

const escapeLead: StripState = {
  consume: (byte) => ({ state: escapeLeadTarget(byte), emitted: "" }),
};

const escapeLeadTarget = (byte: number): StripState => {
  if (byte === 0x5b) {
    return csiBody;
  }
  if (byte === 0x5d || byte === 0x50 || byte === 0x58 || byte === 0x5e || byte === 0x5f) {
    return stringBody;
  }
  if (byte >= 0x20 && byte <= 0x2f) {
    return escapeIntermediate;
  }
  return byte === ESC ? escapeLead : ground;
};

const escapeIntermediate: StripState = {
  consume: (byte) => ({
    state: byte >= 0x20 && byte <= 0x2f ? escapeIntermediate : ground,
    emitted: "",
  }),
};

const csiBody: StripState = {
  consume: (byte) => {
    if (byte >= 0x40 && byte <= 0x7e) {
      return { state: ground, emitted: "" };
    }
    if (byte < 0x20) {
      return { state: ground, emitted: String.fromCharCode(byte) };
    }
    return { state: csiBody, emitted: "" };
  },
};

const stringBody: StripState = {
  consume: (byte) => {
    if (byte === BEL) {
      return { state: ground, emitted: "" };
    }
    return byte === ESC ? { state: stringEscape, emitted: "" } : { state: stringBody, emitted: "" };
  },
};

const stringEscape: StripState = {
  consume: (byte) =>
    byte === 0x5c || byte === BEL ? { state: ground, emitted: "" } : escapeLead.consume(byte),
};

const consumeBytes = (state: StripState, bytes: Buffer): StripStep =>
  bytes.reduce<StripStep>(
    (accumulated, byte) => {
      const step = accumulated.state.consume(byte);
      return { state: step.state, emitted: accumulated.emitted + step.emitted };
    },
    { state, emitted: "" },
  );

const writeChunk = async (destination: PassThrough, part: Buffer): Promise<void> => {
  if (destination.write(part)) return;
  await once(destination, "drain");
};

const stripInto = async (
  chunks: AsyncIterator<Buffer>,
  stripping: { readonly state: StripState; readonly destination: PassThrough },
): Promise<void> => {
  const arrived = await chunks.next();
  if (arrived.done === true) return;
  if (stripping.state === ground && !arrived.value.includes(ESC)) {
    await writeChunk(stripping.destination, arrived.value);
    return stripInto(chunks, stripping);
  }
  const consumed = consumeBytes(stripping.state, arrived.value);
  if (consumed.emitted !== "") {
    await writeChunk(stripping.destination, Buffer.from(consumed.emitted, "latin1"));
  }
  return stripInto(chunks, { state: consumed.state, destination: stripping.destination });
};

const stripUntilExhausted = async (
  source: AsyncIterable<Buffer>,
  destination: PassThrough,
): Promise<void> => {
  try {
    await stripInto(source[Symbol.asyncIterator](), { state: ground, destination });
  } finally {
    destination.end();
  }
};

export const createEscapeStripper = (): Duplex =>
  Duplex.from(async function* (source: AsyncIterable<Buffer>) {
    const stripped = new PassThrough();
    const stripping = stripUntilExhausted(source, stripped);
    yield* stripped;
    await stripping;
  });
