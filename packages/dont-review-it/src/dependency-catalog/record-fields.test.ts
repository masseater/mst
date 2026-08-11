import { describe, expect, it } from "vite-plus/test";

import { recordOf, stringEntriesOf } from "./record-fields.ts";

describe("recordOf", () => {
  it("passes a plain object through", () => {
    expect(recordOf({ name: "left" })).toStrictEqual({ name: "left" });
  });

  it("turns null into an empty record", () => {
    expect(recordOf(null)).toStrictEqual({});
  });

  it("turns an array into an empty record", () => {
    expect(recordOf(["name"])).toStrictEqual({});
  });

  it("turns a scalar into an empty record", () => {
    expect(recordOf("name")).toStrictEqual({});
  });
});

describe("stringEntriesOf", () => {
  it("keeps the entries whose declared specifier is a string", () => {
    expect(stringEntriesOf({ kept: "^1.0.0", dropped: { nested: true } })).toStrictEqual([
      ["kept", "^1.0.0"],
    ]);
  });

  it("reads anything that is not a record as no entries", () => {
    expect(stringEntriesOf(undefined)).toStrictEqual([]);
  });
});
