import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { commandIdOf, defaultSpoolRoot, timestampOf } from "./log-destination.ts";

describe("defaultSpoolRoot", () => {
  describe("a start directory nested under an ancestor carrying a package manifest", () => {
    const markedAncestorDirectory = join(
      tmpdir(),
      `log-destination-marked-ancestor-${process.pid}`,
    );

    const it = test.extend("spoolRootOfTheNestedStart", ({}, { onCleanup }) => {
      const start = join(markedAncestorDirectory, "a", "b");
      mkdirSync(start, { recursive: true });
      onCleanup(() => {
        rmSync(markedAncestorDirectory, { recursive: true, force: true });
      });
      writeFileSync(join(markedAncestorDirectory, "package.json"), "{}");
      return defaultSpoolRoot(start);
    });

    it("puts the spool beside the manifest that ancestor carries", ({
      spoolRootOfTheNestedStart,
    }) => {
      expect(spoolRootOfTheNestedStart).toBe(join(markedAncestorDirectory, ".spool"));
    });
  });

  describe("a start directory with no package manifest above it", () => {
    const unmarkedStartDirectory = join(tmpdir(), `log-destination-unmarked-start-${process.pid}`);

    const it = test.extend("spoolRootOfTheUnmarkedStart", ({}, { onCleanup }) => {
      mkdirSync(unmarkedStartDirectory, { recursive: true });
      onCleanup(() => {
        rmSync(unmarkedStartDirectory, { recursive: true, force: true });
      });
      return defaultSpoolRoot(unmarkedStartDirectory);
    });

    it("puts the spool beside the start directory itself", ({ spoolRootOfTheUnmarkedStart }) => {
      expect(spoolRootOfTheUnmarkedStart).toBe(join(unmarkedStartDirectory, ".spool"));
    });
  });

  describe("a search handed no start directory", () => {
    const it = test.extend("spoolRootOfTheImplicitStart", () => defaultSpoolRoot());

    it("begins the search at the working directory", ({ spoolRootOfTheImplicitStart }) => {
      expect(spoolRootOfTheImplicitStart).toBe(join(process.cwd(), ".spool"));
    });
  });
});

describe("timestampOf", () => {
  describe("an instant carrying milliseconds", () => {
    const it = test.extend("timestampOfAnInstant", () =>
      timestampOf(new Date("2026-08-12T03:04:05.678Z")));

    it("drops to seconds in the basic UTC form whose lexical order is time order", ({
      timestampOfAnInstant,
    }) => {
      expect(timestampOfAnInstant).toBe("20260812T030405Z");
    });
  });
});

describe("commandIdOf", () => {
  describe("a command naming its executable by path and carrying several arguments", () => {
    const it = test.extend("commandIdOfACommandGivenByPath", () =>
      commandIdOf(["/usr/local/bin/node", "-e", "ignored third"]));

    it("keeps the base name of the executable and the first argument, normalised into a name", ({
      commandIdOfACommandGivenByPath,
    }) => {
      expect(commandIdOfACommandGivenByPath).toBe("node--e");
    });
  });

  describe("a command carrying an argument longer than an identifier may run", () => {
    const it = test.extend("commandIdOfACommandWithALongArgument", () =>
      commandIdOf(["command", "x".repeat(80)]));

    it("cuts the identifier at 40 characters", ({ commandIdOfACommandWithALongArgument }) => {
      expect(commandIdOfACommandWithALongArgument).toBe("command-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    });
  });
});
