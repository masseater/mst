import { describe, expect, test } from "vite-plus/test";

import { parseCommand } from "./parse-command.ts";

describe("parseCommand", () => {
  describe("an argv naming no command at all", () => {
    const it = test.extend("theCommand", () => parseCommand([]));

    it("names no command", ({ theCommand }) => {
      expect(theCommand).toBe(undefined);
    });
  });

  describe("an argv carrying the separator with nothing behind it", () => {
    const it = test.extend("theCommand", () => parseCommand(["--"]));

    it("names no command", ({ theCommand }) => {
      expect(theCommand).toBe(undefined);
    });
  });

  describe("an argv putting an option before the separator", () => {
    const it = test.extend("theCommand", () => parseCommand(["-x", "--", "echo", "hi"]));

    it("names no command", ({ theCommand }) => {
      expect(theCommand).toBe(undefined);
    });
  });

  describe("an argv naming a command without the separator", () => {
    const it = test.extend("theCommand", () => parseCommand(["echo", "hi"]));

    it("names no command", ({ theCommand }) => {
      expect(theCommand).toBe(undefined);
    });
  });

  describe("an argv carrying a bare command behind the separator", () => {
    const it = test.extend("theCommand", () => parseCommand(["--", "echo"]));

    it("names that command with no arguments behind it", ({ theCommand }) => {
      expect(theCommand).toStrictEqual(["echo"]);
    });
  });

  describe("an argv carrying a command and its arguments behind the separator", () => {
    const it = test.extend("theCommand", () => parseCommand(["--", "echo", "one", "two"]));

    it("keeps the arguments in the order they were written", ({ theCommand }) => {
      expect(theCommand).toStrictEqual(["echo", "one", "two"]);
    });
  });

  describe("an argv carrying a second separator behind the first", () => {
    const it = test.extend("theCommand", () => parseCommand(["--", "--", "echo"]));

    it("reads the second separator as the command itself", ({ theCommand }) => {
      expect(theCommand).toStrictEqual(["--", "echo"]);
    });
  });
});
