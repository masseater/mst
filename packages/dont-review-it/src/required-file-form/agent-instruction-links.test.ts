import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { agentInstructionLinksIn } from "./agent-instruction-links.ts";
import { defaultRequiredFileFormConfig } from "./config.ts";

const PACKAGE_ROOT = ".";

const MISSING_LINK =
  "A directory that instructs agents must not leave the second name unreachable. Create it here as a symbolic link to AGENTS.md.";

const INSTRUCTIONS_UNDER_THE_LINK =
  "Agent instructions must not live under CLAUDE.md alone. Write them here and leave CLAUDE.md pointing at this file.";

const SPELLED_TWICE =
  "Agent instructions must not be spelled twice. Replace this file with a symbolic link to AGENTS.md.";

describe("agentInstructionLinksIn", () => {
  describe("a directory holding neither name", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agent-instruction-links-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it("says nothing about it", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a directory holding the instructions with no second name", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agent-instruction-links-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "AGENTS.md"), "# instructions\n", "utf8");
      return agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it("asks for the second name as a link", ({ problems }) => {
      expect(problems).toStrictEqual([{ file: "CLAUDE.md", line: null, message: MISSING_LINK }]);
    });
  });

  describe("a directory holding the second name alone", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agent-instruction-links-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "CLAUDE.md"), "# instructions\n", "utf8");
      return agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it("asks for the instructions under the first name", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: null, message: INSTRUCTIONS_UNDER_THE_LINK },
      ]);
    });
  });

  describe("a directory spelling the instructions under both names", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agent-instruction-links-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "AGENTS.md"), "# instructions\n", "utf8");
      writeFileSync(join(repositoryRoot, "CLAUDE.md"), "# instructions\n", "utf8");
      return agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it("asks for the second name to become a link", ({ problems }) => {
      expect(problems).toStrictEqual([{ file: "CLAUDE.md", line: null, message: SPELLED_TWICE }]);
    });
  });

  describe("a second name linked at something other than the instructions", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agent-instruction-links-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "AGENTS.md"), "# instructions\n", "utf8");
      writeFileSync(join(repositoryRoot, "README.md"), "# readme\n", "utf8");
      symlinkSync("README.md", join(repositoryRoot, "CLAUDE.md"));
      return agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it("asks for the link to point at the instructions", ({ problems }) => {
      expect(problems).toStrictEqual([{ file: "CLAUDE.md", line: null, message: SPELLED_TWICE }]);
    });
  });

  describe("a second name linked at the instructions", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agent-instruction-links-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "AGENTS.md"), "# instructions\n", "utf8");
      symlinkSync("AGENTS.md", join(repositoryRoot, "CLAUDE.md"));
      return agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it("says nothing about it", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
