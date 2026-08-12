import { Duplex } from "node:stream";

const ESC = 0x1b;
const BEL = 0x07;

type StripStep = { state: StripState; emitted: string };
type StripState = { consume: (byte: number) => StripStep };

const ground: StripState = {
  consume: (byte) =>
    byte === ESC
      ? { state: escapeLead, emitted: "" }
      : { state: ground, emitted: String.fromCodePoint(byte) },
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
      return { state: ground, emitted: String.fromCodePoint(byte) };
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

class StripCursor {
  private state: StripState = ground;

  advance(chunk: Buffer): Buffer | undefined {
    if (this.state === ground && !chunk.includes(ESC)) {
      return chunk;
    }
    const consumed = consumeBytes(this.state, chunk);
    this.state = consumed.state;
    return consumed.emitted === "" ? undefined : Buffer.from(consumed.emitted, "latin1");
  }
}

export const createEscapeStripper = (): Duplex =>
  Duplex.from(async function* (source: AsyncIterable<Buffer>) {
    const cursor = new StripCursor();
    for await (const chunk of source) {
      const emitted = cursor.advance(chunk);
      if (emitted !== undefined) {
        yield emitted;
      }
    }
  });
