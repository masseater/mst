# 0057. 仕様担保テストは verified-specifications が単独で受け持ち、テスト規律の束の射程から外す

- ステータス: Accepted
- 日付: 2026-08-13

## 文脈

実装済みのルールを preset へ登録し、main を取り込んだところ、`require-spec-lint-coverage--lint-every-spec-file` が `specs/*.spec.ts` に対して 16 件報告した。「テストブロックを宣言しているのに、spec のファイル名を持たない」という報告である。

原因は名前の食い違いではなく、射程の空白だった。テスト規律の束に属するルールはどれも `specFileSuffixesFrom(...)` を通し、その既定は `.test.ts` と `.test.tsx` である。つまり `specs/` の下にある仕様担保テストには、この束のルールが 1 本も届いていない。今回 `specs/*.spec.ts` に出た報告がこのルールのものだけだったことが、それをそのまま示している。ルールは「どの規律も見ていないファイルがある」と正しく言っていた。

一方で、報告文が勧める直し方は採れない。`.test.ts` へ改名することは [AGENTS.md](../../AGENTS.md) の「仕様担保のテストは `specs/<機能名>.spec.ts` に置く」と衝突し、`SPECIFICATIONS.md` の抽出もその名前を前提にしている。

設定で黙らせる道は、この束が自分で塞いでいる。`rules` で下げれば `disabledBundleRule`、`specs/**` の override で下げれば `scopedDisabledBundleRule`、preset の登録から外せば `no-partial-rule-set`、抑制コメントを置けば `no-lint-suppression-in-spec` と `no-rule-suppression` が報告する。このルールだけに `specFileSuffixes` を渡す形も、`settingWrittenPerRule` が同じ設定を約 29 本が読んでいることを理由に報告する。

残る道はコードを変えるか、ルールを変えるかの 2 つしかなく、コードを変える側は上のとおり閉じている。

## 決定

**`specs` ディレクトリの下にある `.spec.ts` と `.spec.tsx` を、別の束が受け持つものとして射程外に置く。** 仕様担保テストの規律は `@mst/verified-specifications` が配る lint 設定と検査コマンドが持っている。この束が届いていないことは欠落ではなく、分担の結果である。

**判定はルールの実装が固定で持ち、設定では動かせないままにする。** ルールの文書が「オプションを持たない。範囲の例外を設定で表現できるようにすると、その例外が取りこぼしと同じ働きをする」と既に決めている。今回の例外はその決定を崩さない形、すなわち実装が 1 箇所で持つ形にした。

**`specs` の外にある `.spec.ts` は引き続き報告する。** そこに置かれたファイルはどちらの束にも届かない。ユーザーの指示も「`specs/` 配下だけ許容する」であり、綴りだけを見て通すのではなく、置き場所と綴りの両方が揃ったときだけ射程外とする。

## なぜ共有の語彙を広げないのか

`DEFAULT_SPEC_FILE_SUFFIXES` に `.spec.ts` を足せば 16 件は同じように消える。採らなかったのは、その語彙を約 30 本のルールが共有しているからである。足せば `no-expect-call-expression--yield-from-fixture` や `require-vitest-extend-builder--infer-fixture-type` を含む fixture 形式の強制が `specs/` に効き始める。仕様担保テストは検査本体の純関数を主語に書くもので、`test.extend` の fixture を挟む形にはしない。語彙を広げることは、16 件を消す代わりに仕様担保テスト全体へ、規約と衝突する移行を要求することになる。

射程の分担を表現したいときに、共有の語彙を動かすのは道具が大きすぎる。

## 影響

**16 件が消え、`specs/` に対する報告は別ルールの既存違反 1 件だけになった。** ルールが正しく発火し続けることは、spec の名前を持たないファイルと、`specs` の外に置いた `.spec.ts` の両方を実際に置いて確認した。

**仕様担保テストの規律の所在が 1 つに定まった。** `@mst/verified-specifications` が単独で持つ。テスト規律の束が `specs/` を見ないことは、これ以降は仕様として読める。

**この束が仕様担保テストの書き方に踏み込むときは、この判断を先に取り消すことになる。** 射程外に置いた以上、片方のルールだけを `specs/` に効かせる形は取れない。

## 検討して採らなかった案

**ルールにオプションを足し、preset から許容する範囲を渡す。** いったん実装したうえで取り消した。ルールの文書が「持たない」と明示的に決めていて、その理由（範囲の例外が取りこぼしと同じ働きをする）は今も有効である。加えて `specFileSuffixes` という名前で渡せば `settingWrittenPerRule` が発火し、別の名前で渡せば同じ意味の設定が 2 つの名前で存在することになる。

**`verified-specifications` の preset に override を置き、`specs/**` でこのルールを off にする。** `scopedDisabledBundleRule` が報告する。この束は範囲を切った無効化を、無効化そのものと同じ壊れ方として扱っている。

**`specs/*.spec.ts` を `.test.ts` へ改名する。** AGENTS.md の配置規約と `SPECIFICATIONS.md` の抽出を同時に壊す。
