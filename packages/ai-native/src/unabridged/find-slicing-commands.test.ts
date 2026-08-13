import { describe, expect, test } from "vite-plus/test";

import { findSlicingCommands } from "./find-slicing-commands.ts";

describe("findSlicingCommands", () => {
  test.each([
    ["vp test | tail -50", ["tail"]],
    ["git log | head", ["head"]],
    ["head -n 20 .spool/run.log", ["head"]],
    ["tail -f .spool/run.log", ["tail"]],
    ["/usr/bin/tail -1 .spool/run.log", ["tail"]],
    ["vp test && tail -5 .spool/run.log", ["tail"]],
    ["vp test; head .spool/run.log", ["head"]],
    ["vp test 2>&1 | tail -20", ["tail"]],
    ["vp test || (head .spool/run.log)", ["head"]],
    ["cat <(tail -1 .spool/run.log)", ["tail"]],
    ["echo $(tail -1 .spool/run.log)", ["tail"]],
    ["ls *.log | tail -1", ["tail"]],
    ["vp test | head -5 | tail -1", ["head", "tail"]],
  ] as const)("コマンド位置の %s は %j を報告する", (commandLine, reported) => {
    expect(findSlicingCommands(commandLine)).toStrictEqual(reported);
  });

  test.each([
    ["git rev-parse HEAD"],
    ["git reset --hard origin/main"],
    ["echo 'tail'"],
    ['echo "heading"'],
    ["cat headers.txt"],
    ["vp test > tail"],
    ["vp test >> tail"],
    ["ls *.log"],
    ["ls # tail"],
    [""],
  ] as const)("コマンド位置に無い %s は報告しない", (commandLine) => {
    expect(findSlicingCommands(commandLine)).toStrictEqual([]);
  });

  test.each([["bash -c 'vp test | tail -5'"], ["ls | xargs head"]] as const)(
    "入れ子のシェルと引数として渡される %s は境界の外にあり報告しない",
    (commandLine) => {
      expect(findSlicingCommands(commandLine)).toStrictEqual([]);
    },
  );

  test("解釈できないコマンド行は握り潰さず失敗として表に出す", () => {
    expect(() => findSlicingCommands("echo ${}")).toThrow("Bad substitution");
  });
});
