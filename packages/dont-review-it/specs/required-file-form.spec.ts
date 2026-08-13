import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { defaultRequiredFileFormConfig } from "../src/required-file-form/config.ts";
import { runRequiredFileFormChecks } from "../src/required-file-form/run-required-file-form-checks.ts";

import type { ScannedProblems } from "@mst/repository-checks";

const scannedFor = async ({
  files,
  links,
}: {
  readonly files: Readonly<Record<string, string>>;
  readonly links?: Readonly<Record<string, string>>;
}): Promise<ScannedProblems> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-required-file-form-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([fileName, source]) => {
      const absolutePath = join(repositoryRoot, fileName);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, source, "utf-8");
    }),
  );
  await Promise.all(
    Object.entries(links ?? {}).map(async ([fileName, pointsAt]) =>
      symlink(pointsAt, join(repositoryRoot, fileName)),
    ),
  );

  return runRequiredFileFormChecks({ repositoryRoot, config: defaultRequiredFileFormConfig });
};

describe("必須ファイルの形の検査", () => {
  it("JSON で置かれた knip の設定を、TypeScript の綴りを名指しして報告する", async () => {
    const scanned = await scannedFor({ files: { "knip.json": `{}\n` } });

    expect(scanned.problems).toStrictEqual([
      {
        file: "knip.json",
        line: null,
        message:
          "A configuration for knip must not stay in a format the type checker never reads. Move what it declares into knip.ts.",
      },
    ]);
  });

  it("JSON で置かれた oxlint の設定を、ツールチェーン設定へ移す指示とともに報告する", async () => {
    const scanned = await scannedFor({ files: { ".oxlintrc.jsonc": `{}\n` } });

    expect(scanned.problems).toStrictEqual([
      {
        file: ".oxlintrc.jsonc",
        line: null,
        message:
          "A configuration for oxlint must not stay in a format the type checker never reads. Move what it declares into vite.config.ts.",
      },
    ]);
  });

  it("旧来の rc 形式で置かれた eslint の設定を報告する", async () => {
    const scanned = await scannedFor({ files: { ".eslintrc.yml": `root: true\n` } });

    expect(scanned.problems).toStrictEqual([
      {
        file: ".eslintrc.yml",
        line: null,
        message:
          "A configuration for eslint must not stay in a format the type checker never reads. Move what it declares into eslint.config.ts.",
      },
    ]);
  });

  it("JavaScript で置かれた vite の設定を報告する", async () => {
    const scanned = await scannedFor({ files: { "vite.config.mjs": `export default {};\n` } });

    expect(scanned.problems).toStrictEqual([
      {
        file: "vite.config.mjs",
        line: null,
        message:
          "A configuration for vite must not stay in a format the type checker never reads. Move what it declares into vite.config.ts.",
      },
    ]);
  });

  it("リポジトリの根だけでなく、マニフェストを持つディレクトリに置かれた設定も報告する", async () => {
    const scanned = await scannedFor({
      files: {
        "package.json": `{"name": "root"}`,
        "packages/web/package.json": `{"name": "web"}`,
        "packages/web/vite.config.js": `export default {};\n`,
      },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "packages/web/vite.config.js",
        line: null,
        message:
          "A configuration for vite must not stay in a format the type checker never reads. Move what it declares into vite.config.ts.",
      },
    ]);
  });

  it("TypeScript で書かれた設定を報告しない", async () => {
    const scanned = await scannedFor({
      files: {
        "knip.ts": `export default {};\n`,
        "vite.config.ts": `export default {};\n`,
        "eslint.config.ts": `export default [];\n`,
      },
    });

    expect(scanned.problems).toStrictEqual([]);
  });

  it("AGENTS.md を持つディレクトリに CLAUDE.md が無いことを報告する", async () => {
    const scanned = await scannedFor({ files: { "AGENTS.md": "# rules\n" } });

    expect(scanned.problems).toStrictEqual([
      {
        file: "CLAUDE.md",
        line: null,
        message:
          "A directory that instructs agents must not leave the second name unreachable. Create it here as a symbolic link to AGENTS.md.",
      },
    ]);
  });

  it("CLAUDE.md が中身を持つ実体ファイルであることを報告する", async () => {
    const scanned = await scannedFor({
      files: { "AGENTS.md": "# rules\n", "CLAUDE.md": "# rules\n" },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "CLAUDE.md",
        line: null,
        message:
          "Agent instructions must not be spelled twice. Replace this file with a symbolic link to AGENTS.md.",
      },
    ]);
  });

  it("CLAUDE.md が AGENTS.md 以外を指すシンボリックリンクであることを報告する", async () => {
    const scanned = await scannedFor({
      files: { "AGENTS.md": "# rules\n", "README.md": "# readme\n" },
      links: { "CLAUDE.md": "README.md" },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "CLAUDE.md",
        line: null,
        message:
          "Agent instructions must not be spelled twice. Replace this file with a symbolic link to AGENTS.md.",
      },
    ]);
  });

  it("CLAUDE.md だけがあって AGENTS.md が無いことを報告する", async () => {
    const scanned = await scannedFor({
      files: { "README.md": "# readme\n" },
      links: { "CLAUDE.md": "AGENTS.md" },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "AGENTS.md",
        line: null,
        message:
          "Agent instructions must not live under CLAUDE.md alone. Write them here and leave CLAUDE.md pointing at this file.",
      },
    ]);
  });

  it("AGENTS.md を指すシンボリックリンクの CLAUDE.md を報告しない", async () => {
    const scanned = await scannedFor({
      files: { "AGENTS.md": "# rules\n" },
      links: { "CLAUDE.md": "AGENTS.md" },
    });

    expect(scanned.problems).toStrictEqual([]);
  });

  it("どちらの指示ファイルも無いディレクトリを報告しない", async () => {
    const scanned = await scannedFor({ files: { "README.md": "# readme\n" } });

    expect(scanned.problems).toStrictEqual([]);
  });

  it("マニフェストを 1 つも持たないリポジトリでも、根を開いた対象として数える", async () => {
    const scanned = await scannedFor({ files: { "README.md": "# empty\n" } });

    expect(scanned.scanned).toBe(1);
  });
});
