# 0020. ルールが要求する import の並びを整形器に出力させる

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

[0016](0016-enforce-with-upstream-rules-before-writing-our-own.md) が入れた `no-unordered-import--group-by-origin-then-sort-by-specifier` は、import の並びを由来のブロック順（組み込み → インストール済み → リポジトリ内 → 型のみ）とブロック内の指定子昇順で固定する。自動修正は持たず、直すのは書いた側になっていた。

自動修正を付けなかった根拠は、並べ替えが評価順序を変えうることだった。これは束縛を持たない import（`import "./style.css";`）にだけ当てはまる。ルール自身がそれを検査の対象から外しており、oxfmt の `sortImports` も `sortSideEffects` が既定で無効で並べ替えない。この構成では根拠が成立しない。

oxfmt の `sortImports` を既定のまま有効にすると、既定の group 順は型の import を先頭に置くため、このルールが要求する順序と正面から逆になる。

## 決定

**`fmt.sortImports` を有効にし、`groups` と `customGroups` でルールが要求する並びをそのまま出力させる。** 並びの権威はルールに残し、直す作業だけを整形器に移す。

型の import は指定子の由来に関わらず 1 つのブロックに集まり、その内側で由来ごとに並ぶ。oxfmt の predefined group は型の import を単一の `type` selector で扱うため、由来による細分は `customGroups` で行う。`node:` で始まるもの、相対指定子のもの、残りの 3 つに分け、`groups` にこの順で並べる。ブロックの内側に空行が入らないよう `{ newlinesBetween: false }` を境界に置く。

**ルールは残す。** 整形器が直せるようになっても検出をやめない。整形が走らない経路（エディタの保存を経ないコミット、生成物の取り込み）で並びが崩れたときに、`vp check` が止める役割はルールにしかない。

## 影響

既存のコードは 1 行も変わらない。設定がルールの要求と同じ並びを出すので、ルールを満たしている今の状態が整形器の出力と一致する。

import を足す位置を考える必要が無くなる。どこに書いても `vp check --fix` と pre-commit が既定の位置へ移す。

この 2 つが食い違うと、`vp fmt` が書いた並びを `vp lint` が拒む状態になり、`vp check --fix` が収束しなくなる。ルールの並び順を変えるときは `fmt.sortImports` も同時に変える。

`fmt` ブロックを削除してはならない。削除すると oxfmt は `vite.config.ts` を設定として認識せず `No config found, using defaults.` を出す。既定の group 順は型を先頭に置くので、この状態で `vp fmt --write` が走ると全ファイルがルール違反になる。
