# 0033. なんでも共有の utils を解体し、検査の契約だけを名前付きで残す

## 状況

`vp create vite:monorepo` のテンプレートが置いた `packages/utils` が、「複数のパッケージが必要とし、誰も所有しない宣言の中立の置き場」へ転用されていた。8 つの export を 4 パッケージ 35 箇所が取り込んでいた。

これは [置き場所と道具](../guidelines/placement-and-tools.md) が残余の区分に課す「所有者がまだ決まっていない印として扱い、増えたら減らす」に反した状態で、置き場所に迷った宣言の既定の行き先になっていた。なんでも受け入れる共有パッケージは持たない、という要求がこの解体の出発点にある。

## 決定

utils を 1 対 1 で改名するのではなく、export ごとに次の順で判定して解体する。

1. 1 行の式で書ける処理は、関数として共有しない。呼び出し箇所に式として書く
   - `toLines`（5 箇所）と `lineAtOffset`（7 箇所）を式として展開した
2. ライブラリの型付けで不要にできる関数は消す
   - `failureMessage` は `attempt<CliResult, Error>` と型を付ければ `failure.message` で足りる
3. 1 つの領域にしか属さない語彙は、その領域を所有するパッケージへ、既存の依存の向きに沿って移す
   - `UnknownFields` の利用者は lint ルール実装だけなので `@mst/lint-rule-authoring` へ移した。`dont-review-it → lint-rule-authoring` の辺は既にある
4. それでも残った宣言だけを、責務を名乗るパッケージに置く
   - 残ったのは `EXIT_*` / `CliResult` / `RepositoryProblem` / `readUnlessMissing`（+ `failureCodeOf`）で、すべて「検査がリポジトリを読み、問題の形を揃え、終了コードで結果を伝える」という 1 つの契約に属する。これを `@mst/repository-checks` と名乗らせる

残りを複製で散らさないのは、一字一句同じ宣言を抑制不可の error で止める自前 lint（[0013](0013-draw-the-duplication-line-at-decidability.md)）に弾かれるからである。既存パッケージへ畳み込まないのは、契約の利用者に `lint-rule-authoring` と、それに依存する `dont-review-it` の両方がいて、どちらに置いても逆向きの import が生まれ循環するからである。

契約に属さない宣言の持ち込みは、パッケージの AGENTS.md が禁じる。

## 帰結

- 「誰も所有しない置き場」は消えた。次に迷った宣言が現れたとき、既定の行き先は無く、所有者を決めるか式として書くかを選ぶことになる
- 展開した式の写しが呼び出し箇所に散った。duplicated-bodies の検出は宣言だけを見るため、式の写しの食い違いは機械では止まらない
- CLI を citty へ寄せる決定（未 merge のブランチが 0031 として持つ）が main に入れば、終了契約の宣言はさらに縮みうる
- 旧名 `@mst/utils` / 旧パス `packages/utils` を参照する並行ブランチは、main を取り込むときに modify/delete の衝突か、消えたパスへのファイル復活を踏む。取り込み時に新しい置き場所へ寄せ直す必要がある
