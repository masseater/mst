import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { defaultRequiredFileFormConfig } from "../src/required-file-form/config.ts";
import { runRequiredFileFormChecks } from "../src/required-file-form/run-required-file-form-checks.ts";

import type { ScannedProblems } from "@mst/repository-checks";

const scannedFor = async ({
  directories,
  files,
  links,
}: {
  readonly directories?: readonly string[];
  readonly files: Readonly<Record<string, string>>;
  readonly links?: Readonly<Record<string, string>>;
}): Promise<ScannedProblems> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-required-file-form-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    (directories ?? []).map(async (directory) =>
      mkdir(join(repositoryRoot, directory), { recursive: true }),
    ),
  );
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

  it("マニフェストのない下位ディレクトリの Oxlint nested config を報告する", async () => {
    const scanned = await scannedFor({
      files: { "src/oxlint.config.ts": `export default { rules: {} };\n` },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "src/oxlint.config.ts",
        line: null,
        message:
          "A configuration for oxlint must not stay in a format the type checker never reads. Move what it declares into vite.config.ts.",
      },
    ]);
  });

  it("Oxlint が自動で読む ESLint ignore file を報告する", async () => {
    const scanned = await scannedFor({ files: { ".eslintignore": `src/**\n` } });

    expect(scanned.problems).toStrictEqual([
      {
        file: ".eslintignore",
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

  it("リポジトリの根または package.json を持つディレクトリでは、AGENTS.md があれば CLAUDE.md も要求する", async () => {
    const scanned = await scannedFor({
      files: {
        "packages/web/AGENTS.md": "# rules\n",
        "packages/web/package.json": `{ "name": "web" }\n`,
      },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "packages/web/CLAUDE.md",
        line: null,
        message:
          "A directory that instructs agents must not leave the second name unreachable. Create it here as a symbolic link to AGENTS.md.",
      },
    ]);
  });

  it("リポジトリの根または package.json を持つディレクトリでは、CLAUDE.md の実体ファイルを受理しない", async () => {
    const scanned = await scannedFor({
      files: { "AGENTS.md": "# rules\n", "CLAUDE.md": "# rules\n" },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "CLAUDE.md",
        line: null,
        message:
          "CLAUDE.md must be a symbolic link whose target is exactly AGENTS.md. Replace this entry with that link.",
      },
    ]);
  });

  it("リポジトリの根または package.json を持つディレクトリでは、CLAUDE.md が AGENTS.md 以外を指すリンクを受理しない", async () => {
    const scanned = await scannedFor({
      files: { "AGENTS.md": "# rules\n", "README.md": "# readme\n" },
      links: { "CLAUDE.md": "README.md" },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "CLAUDE.md",
        line: null,
        message:
          "CLAUDE.md must be a symbolic link whose target is exactly AGENTS.md. Replace this entry with that link.",
      },
    ]);
  });

  it("リポジトリの根または package.json を持つディレクトリでは、CLAUDE.md だけを置く形を受理しない", async () => {
    const scanned = await scannedFor({
      files: { "README.md": "# readme\n" },
      links: { "CLAUDE.md": "AGENTS.md" },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "AGENTS.md",
        line: null,
        message:
          "Agent instructions must live in AGENTS.md as a regular file. Write that file here and leave CLAUDE.md pointing at it.",
      },
    ]);
  });

  it("リポジトリの根または package.json を持つディレクトリでは、通常ファイルの AGENTS.md と文字列どおりそれを指す CLAUDE.md を受理する", async () => {
    const scanned = await scannedFor({
      files: { "AGENTS.md": "# rules\n" },
      links: { "CLAUDE.md": "AGENTS.md" },
    });

    expect(scanned.problems).toStrictEqual([]);
  });

  it("リポジトリの根または package.json を持つディレクトリに指示ファイルが無ければ報告しない", async () => {
    const scanned = await scannedFor({ files: { "README.md": "# readme\n" } });

    expect(scanned.problems).toStrictEqual([]);
  });

  it("リポジトリの根または package.json を持つディレクトリでは、AGENTS.md を別ファイルへのリンクとして受理しない", async () => {
    const scanned = await scannedFor({
      files: { "RULES.md": "# rules\n" },
      links: { "AGENTS.md": "RULES.md", "CLAUDE.md": "AGENTS.md" },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "AGENTS.md",
        line: null,
        message:
          "Agent instructions must live in AGENTS.md as a regular file. Write that file here and leave CLAUDE.md pointing at it.",
      },
    ]);
  });

  it("リポジトリの根または package.json を持つディレクトリでは、AGENTS.md と同名のディレクトリを通常ファイルとして受理しない", async () => {
    const scanned = await scannedFor({
      directories: ["AGENTS.md"],
      files: {},
      links: { "CLAUDE.md": "AGENTS.md" },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "AGENTS.md",
        line: null,
        message:
          "Agent instructions must live in AGENTS.md as a regular file. Write that file here and leave CLAUDE.md pointing at it.",
      },
    ]);
  });

  it("リポジトリの根または package.json を持つディレクトリでは、CLAUDE.md と同名のディレクトリをリンクとして受理しない", async () => {
    const scanned = await scannedFor({
      directories: ["CLAUDE.md"],
      files: { "AGENTS.md": "# rules\n" },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "CLAUDE.md",
        line: null,
        message:
          "CLAUDE.md must be a symbolic link whose target is exactly AGENTS.md. Replace this entry with that link.",
      },
    ]);
  });

  it("リポジトリの根または package.json を持つディレクトリでは、CLAUDE.md のリンク先を文字列どおり AGENTS.md と要求する", async () => {
    const scanned = await scannedFor({
      files: { "AGENTS.md": "# rules\n" },
      links: { "CLAUDE.md": "./AGENTS.md" },
    });

    expect(scanned.problems).toStrictEqual([
      {
        file: "CLAUDE.md",
        line: null,
        message:
          "CLAUDE.md must be a symbolic link whose target is exactly AGENTS.md. Replace this entry with that link.",
      },
    ]);
  });

  it("package.json を持たない docs ディレクトリの AGENTS.md は走査対象を増やさない", async () => {
    const scanned = await scannedFor({ files: { "docs/AGENTS.md": "# rules\n" } });

    expect(scanned).toStrictEqual({ problems: [], scanned: 1 });
  });

  it("マニフェストを 1 つも持たないリポジトリでも、根を開いた対象として数える", async () => {
    const scanned = await scannedFor({ files: { "README.md": "# empty\n" } });

    expect(scanned.scanned).toBe(1);
  });
});
