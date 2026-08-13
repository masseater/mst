import { describe, expect, test } from "vite-plus/test";

import { findSlicingCommands } from "./find-slicing-commands.ts";

describe("findSlicingCommands", () => {
  const it = test
    .extend("pipedTailSlicers", () => findSlicingCommands("vp test | tail -50"))
    .extend("pipedHeadSlicers", () => findSlicingCommands("git log | head"))
    .extend("leadingHeadSlicers", () => findSlicingCommands("head -n 20 .spool/run.log"))
    .extend("followedTailSlicers", () => findSlicingCommands("tail -f .spool/run.log"))
    .extend("absolutePathTailSlicers", () => findSlicingCommands("/usr/bin/tail -1 .spool/run.log"))
    .extend("andChainedTailSlicers", () => findSlicingCommands("vp test && tail -5 .spool/run.log"))
    .extend("semicolonChainedHeadSlicers", () =>
      findSlicingCommands("vp test; head .spool/run.log"),
    )
    .extend("redirectedPipeTailSlicers", () => findSlicingCommands("vp test 2>&1 | tail -20"))
    .extend("subshellHeadSlicers", () => findSlicingCommands("vp test || (head .spool/run.log)"))
    .extend("processSubstitutionTailSlicers", () =>
      findSlicingCommands("cat <(tail -1 .spool/run.log)"),
    )
    .extend("commandSubstitutionTailSlicers", () =>
      findSlicingCommands("echo $(tail -1 .spool/run.log)"),
    )
    .extend("globPipedTailSlicers", () => findSlicingCommands("ls *.log | tail -1"))
    .extend("chainedHeadAndTailSlicers", () => findSlicingCommands("vp test | head -5 | tail -1"))
    .extend("revParseHeadSlicers", () => findSlicingCommands("git rev-parse HEAD"))
    .extend("resetHardSlicers", () => findSlicingCommands("git reset --hard origin/main"))
    .extend("singleQuotedTailSlicers", () => findSlicingCommands("echo 'tail'"))
    .extend("doubleQuotedHeadingSlicers", () => findSlicingCommands('echo "heading"'))
    .extend("headersFileSlicers", () => findSlicingCommands("cat headers.txt"))
    .extend("redirectTargetTailSlicers", () => findSlicingCommands("vp test > tail"))
    .extend("appendTargetTailSlicers", () => findSlicingCommands("vp test >> tail"))
    .extend("globOnlySlicers", () => findSlicingCommands("ls *.log"))
    .extend("commentedTailSlicers", () => findSlicingCommands("ls # tail"))
    .extend("emptyCommandLineSlicers", () => findSlicingCommands(""))
    .extend("nestedShellSlicers", () => findSlicingCommands("bash -c 'vp test | tail -5'"))
    .extend("xargsHeadSlicers", () => findSlicingCommands("ls | xargs head"))
    .extend("badSubstitutionRejection", () => {
      try {
        findSlicingCommands("echo ${}");
      } catch (rejection) {
        return rejection;
      }
      throw new Error("findSlicingCommands accepted the command line echo ${}");
    });

  it("パイプの右で始まる tail を報告する", ({ pipedTailSlicers }) => {
    expect(pipedTailSlicers).toStrictEqual(["tail"]);
  });

  it("パイプの右で引数なしに始まる head を報告する", ({ pipedHeadSlicers }) => {
    expect(pipedHeadSlicers).toStrictEqual(["head"]);
  });

  it("行頭の head を報告する", ({ leadingHeadSlicers }) => {
    expect(leadingHeadSlicers).toStrictEqual(["head"]);
  });

  it("追従読み出しの tail を報告する", ({ followedTailSlicers }) => {
    expect(followedTailSlicers).toStrictEqual(["tail"]);
  });

  it("絶対パスで書かれた tail を報告する", ({ absolutePathTailSlicers }) => {
    expect(absolutePathTailSlicers).toStrictEqual(["tail"]);
  });

  it("&& の右で始まる tail を報告する", ({ andChainedTailSlicers }) => {
    expect(andChainedTailSlicers).toStrictEqual(["tail"]);
  });

  it("セミコロンの右で始まる head を報告する", ({ semicolonChainedHeadSlicers }) => {
    expect(semicolonChainedHeadSlicers).toStrictEqual(["head"]);
  });

  it("リダイレクトを挟んだパイプの右の tail を報告する", ({ redirectedPipeTailSlicers }) => {
    expect(redirectedPipeTailSlicers).toStrictEqual(["tail"]);
  });

  it("サブシェルの先頭で始まる head を報告する", ({ subshellHeadSlicers }) => {
    expect(subshellHeadSlicers).toStrictEqual(["head"]);
  });

  it("プロセス置換の先頭で始まる tail を報告する", ({ processSubstitutionTailSlicers }) => {
    expect(processSubstitutionTailSlicers).toStrictEqual(["tail"]);
  });

  it("コマンド置換の先頭で始まる tail を報告する", ({ commandSubstitutionTailSlicers }) => {
    expect(commandSubstitutionTailSlicers).toStrictEqual(["tail"]);
  });

  it("グロブを含む行のパイプの右の tail を報告する", ({ globPipedTailSlicers }) => {
    expect(globPipedTailSlicers).toStrictEqual(["tail"]);
  });

  it("二段のパイプに現れる head と tail を両方報告する", ({ chainedHeadAndTailSlicers }) => {
    expect(chainedHeadAndTailSlicers).toStrictEqual(["head", "tail"]);
  });

  it("引数として現れる HEAD は報告しない", ({ revParseHeadSlicers }) => {
    expect(revParseHeadSlicers).toStrictEqual([]);
  });

  it("破壊的な reset の行に切り出しコマンドは無い", ({ resetHardSlicers }) => {
    expect(resetHardSlicers).toStrictEqual([]);
  });

  it("単引用符で囲まれた tail は報告しない", ({ singleQuotedTailSlicers }) => {
    expect(singleQuotedTailSlicers).toStrictEqual([]);
  });

  it("二重引用符で囲まれた heading は報告しない", ({ doubleQuotedHeadingSlicers }) => {
    expect(doubleQuotedHeadingSlicers).toStrictEqual([]);
  });

  it("head で始まるファイル名の引数は報告しない", ({ headersFileSlicers }) => {
    expect(headersFileSlicers).toStrictEqual([]);
  });

  it("リダイレクト先の tail は報告しない", ({ redirectTargetTailSlicers }) => {
    expect(redirectTargetTailSlicers).toStrictEqual([]);
  });

  it("追記リダイレクト先の tail は報告しない", ({ appendTargetTailSlicers }) => {
    expect(appendTargetTailSlicers).toStrictEqual([]);
  });

  it("グロブだけの行に切り出しコマンドは無い", ({ globOnlySlicers }) => {
    expect(globOnlySlicers).toStrictEqual([]);
  });

  it("コメントに書かれた tail は報告しない", ({ commentedTailSlicers }) => {
    expect(commentedTailSlicers).toStrictEqual([]);
  });

  it("空のコマンド行に切り出しコマンドは無い", ({ emptyCommandLineSlicers }) => {
    expect(emptyCommandLineSlicers).toStrictEqual([]);
  });

  it("入れ子のシェルに渡された tail は境界の外にあり報告しない", ({ nestedShellSlicers }) => {
    expect(nestedShellSlicers).toStrictEqual([]);
  });

  it("xargs の引数として渡された head は報告しない", ({ xargsHeadSlicers }) => {
    expect(xargsHeadSlicers).toStrictEqual([]);
  });

  it("解釈できないコマンド行は握り潰さず失敗として表に出す", ({ badSubstitutionRejection }) => {
    expect(badSubstitutionRejection).toStrictEqual(new Error("Bad substitution: ${}"));
  });
});
