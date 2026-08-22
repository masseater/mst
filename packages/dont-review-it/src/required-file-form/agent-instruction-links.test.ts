import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { agentInstructionLinksIn } from "./agent-instruction-links.ts";
import { defaultRequiredFileFormConfig } from "./config.ts";

describe("agentInstructionLinksIn", () => {
  describe("a two-stage symlink chain", () => {
    const it = test.extend("problemsOverTwoStageSymlinkChain", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agent-instruction-links-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "RULES.md"), "# rules\n", "utf8");
      symlinkSync("RULES.md", join(repositoryRoot, "AGENTS.md"));
      symlinkSync("AGENTS.md", join(repositoryRoot, "CLAUDE.md"));
      return agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: ".",
        config: defaultRequiredFileFormConfig,
      });
    });

    it("rejects AGENTS.md when it is the first link", ({ problemsOverTwoStageSymlinkChain }) => {
      expect(problemsOverTwoStageSymlinkChain).toStrictEqual([
        {
          file: "AGENTS.md",
          line: null,
          message:
            "Agent instructions must live in AGENTS.md as a regular file. Write that file here and leave CLAUDE.md pointing at it.",
        },
      ]);
    });
  });

  describe("a directory named AGENTS.md", () => {
    const it = test.extend("problemsOverAgentInstructionDirectory", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agent-instruction-links-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "AGENTS.md"));
      symlinkSync("AGENTS.md", join(repositoryRoot, "CLAUDE.md"));
      return agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: ".",
        config: defaultRequiredFileFormConfig,
      });
    });

    it("rejects the directory as the instruction file", ({
      problemsOverAgentInstructionDirectory,
    }) => {
      expect(problemsOverAgentInstructionDirectory).toStrictEqual([
        {
          file: "AGENTS.md",
          line: null,
          message:
            "Agent instructions must live in AGENTS.md as a regular file. Write that file here and leave CLAUDE.md pointing at it.",
        },
      ]);
    });
  });

  describe("an equivalent but differently spelled CLAUDE.md target", () => {
    const it = test.extend("problemsOverDifferentlySpelledTarget", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agent-instruction-links-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "AGENTS.md"), "# rules\n", "utf8");
      symlinkSync("./AGENTS.md", join(repositoryRoot, "CLAUDE.md"));
      return agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: ".",
        config: defaultRequiredFileFormConfig,
      });
    });

    it("rejects the target spelling", ({ problemsOverDifferentlySpelledTarget }) => {
      expect(problemsOverDifferentlySpelledTarget).toStrictEqual([
        {
          file: "CLAUDE.md",
          line: null,
          message:
            "CLAUDE.md must be a symbolic link whose target is exactly AGENTS.md. Replace this entry with that link.",
        },
      ]);
    });
  });

  describe("an exact CLAUDE.md target", () => {
    const it = test.extend("problemsOverExactTarget", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "agent-instruction-links-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "AGENTS.md"), "# rules\n", "utf8");
      symlinkSync("AGENTS.md", join(repositoryRoot, "CLAUDE.md"));
      return agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: ".",
        config: defaultRequiredFileFormConfig,
      });
    });

    it("accepts the regular file and link pair", ({ problemsOverExactTarget }) => {
      expect(problemsOverExactTarget).toStrictEqual([]);
    });
  });
});
