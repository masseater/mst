import { describe, expect, test } from "vite-plus/test";

import { failureMessage } from "./failure-message.ts";

const it = test
  .extend("errorDescription", () => failureMessage(new Error("unknown option")))
  .extend("stringDescription", () => failureMessage("unknown option"))
  .extend("numberDescription", () => failureMessage(7));

describe("failureMessage", () => {
  it("an error is described by the message it carries", ({ errorDescription }) => {
    expect(errorDescription).toBe("unknown option");
  });

  it("a thrown string is described by how it spells out", ({ stringDescription }) => {
    expect(stringDescription).toBe("unknown option");
  });

  it("a thrown number is described by how it spells out", ({ numberDescription }) => {
    expect(numberDescription).toBe("7");
  });
});
