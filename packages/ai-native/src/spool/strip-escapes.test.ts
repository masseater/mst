import { describe, expect, test } from "vite-plus/test";

import { createEscapeStripper } from "./strip-escapes.ts";

const strip = async (writtenChunks: (Buffer | string)[]): Promise<string> => {
  const stripper = createEscapeStripper();
  for (const writtenChunk of writtenChunks) {
    stripper.write(typeof writtenChunk === "string" ? Buffer.from(writtenChunk) : writtenChunk);
  }
  stripper.end();
  const collected = await Array.fromAsync(stripper as AsyncIterable<Buffer>);
  return Buffer.concat(collected).toString();
};

describe("createEscapeStripper", () => {
  test("エスケープ列を含まない入力はそのまま通る", async () => {
    expect(await strip(["plain text\nsecond line\n"])).toStrictEqual("plain text\nsecond line\n");
  });

  test("SGR の色指定が除去され可視文字は残る", async () => {
    expect(await strip(["\x1b[31mred\x1b[0m end"])).toStrictEqual("red end");
  });

  test("カーソル移動と消去の CSI 列が除去される", async () => {
    expect(await strip(["a\x1b[2K\x1b[1;5Hb\x1b[?25lc"])).toStrictEqual("abc");
  });

  test("チャンク境界で分割された CSI 列も除去される", async () => {
    expect(await strip(["one\x1b", "[3", "2mtwo"])).toStrictEqual("onetwo");
  });

  test("ESC 単体でチャンクが終わり次のチャンクが平文で始まる場合は 2 文字エスケープとして消える", async () => {
    expect(await strip(["a\x1b", "Mb"])).toStrictEqual("ab");
  });

  test("OSC 列は BEL 終端まで除去される", async () => {
    expect(await strip(["x\x1b]0;window title\x07y"])).toStrictEqual("xy");
  });

  test("OSC 列は ST 終端まで除去される", async () => {
    expect(await strip(["x\x1b]8;;https://example.com\x1b\\y"])).toStrictEqual("xy");
  });

  test("DCS と APC の列が ST 終端まで除去される", async () => {
    expect(await strip(["a\x1bPq#0\x1b\\b\x1b_note\x1b\\c"])).toStrictEqual("abc");
  });

  test("制御文字列の中の ESC が ST 以外に続く場合は新たなエスケープとして解釈される", async () => {
    expect(await strip(["a\x1b]0;title\x1b[31mred"])).toStrictEqual("ared");
  });

  test("制御文字列の中の ESC に BEL が続く場合も終端になる", async () => {
    expect(await strip(["a\x1b]0;t\x1b\x07b"])).toStrictEqual("ab");
  });

  test("文字集合指定の中間バイト付きエスケープが除去される", async () => {
    expect(await strip(["a\x1b(Bb\x1b#8c"])).toStrictEqual("abc");
  });

  test("中間バイトが複数続くエスケープも除去される", async () => {
    expect(await strip(["a\x1b$(0b"])).toStrictEqual("ab");
  });

  test("中間バイトの後に制御文字が来る壊れた列は打ち切られる", async () => {
    expect(await strip(["a\x1b(\x01b"])).toStrictEqual("ab");
  });

  test("連続する ESC は最後の 1 列だけとして解釈される", async () => {
    expect(await strip(["a\x1b\x1b[1mb"])).toStrictEqual("ab");
  });

  test("CSI の途中に改行が来た場合は列を打ち切り改行を残す", async () => {
    expect(await strip(["a\x1b[3\nb"])).toStrictEqual("a\nb");
  });

  test("入力の末尾で未完のエスケープ列は捨てられる", async () => {
    expect(await strip(["done\x1b[3"])).toStrictEqual("done");
    expect(await strip(["done\x1b"])).toStrictEqual("done");
  });

  test("マルチバイト文字がチャンク境界で分割されても壊れない", async () => {
    const bytes = Buffer.from("日本語\x1b[1m強調\x1b[0m");
    expect(await strip([bytes.subarray(0, 4), bytes.subarray(4)])).toStrictEqual("日本語強調");
  });

  test("エスケープ列だけの入力は空になる", async () => {
    expect(await strip(["\x1b[1m\x1b[0m"])).toStrictEqual("");
  });
});
