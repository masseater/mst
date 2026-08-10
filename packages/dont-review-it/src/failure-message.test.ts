import { expect, test } from "vite-plus/test";

import { failureMessage } from "./failure-message.ts";

test("an error is described by the message it carries", () => {
  expect(failureMessage(new Error("unknown option"))).toBe("unknown option");
});

test("anything else thrown is described by how it spells out", () => {
  expect(failureMessage("unknown option")).toBe("unknown option");
  expect(failureMessage(7)).toBe("7");
});
