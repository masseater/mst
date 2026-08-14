# @mst/dont-review-it

生成物。`vp run guard:fix` が `specs/` の仕様担保テストから再生成する。手で編集しない。

## 値の正典の検査

[`specs/canonical-values.spec.ts`](specs/canonical-values.spec.ts)

- 同じ概念を 2 か所で宣言していたら、先に宣言した場所を挙げて報告する
- 同じ値の集合を別々の概念が宣言していたら、両方の概念を挙げて警告し、落とさない
- 概念を名指ししない注釈を報告する
- 退役した注釈タグが残っていたら報告する
- テストファイルが繰り返す値の集合を二重宣言と数えない

## リポジトリ検査の入口

[`specs/check-entry.spec.ts`](specs/check-entry.spec.ts)

- check 以外の命令を名指しで拒否する
- 存在しない場所を検査対象に取らない

## 依存宣言の検査

[`specs/dependency-declarations.spec.ts`](specs/dependency-declarations.spec.ts)

- ワークスペース定義の無いリポジトリでは依存を検査しない
- 解釈できないワークスペース定義を、どの検査も素通りする前に報告する
- 1 つのマニフェストしか使わない catalog エントリを報告する
- overrides が catalog: で参照するエントリは、使うマニフェストが 1 つでも通す
- catalog が持つバージョンをマニフェストが直接書き写していたら報告する
- 複数のマニフェストが catalog の外で同じバージョンを繰り返していたら報告する
- バージョンが食い違う宣言は警告に留め、検査を失敗させない

## 重複した宣言本体の検査

[`specs/duplicated-bodies.spec.ts`](specs/duplicated-bodies.spec.ts)

- 同じ本体を綴る宣言を、繰り返しているすべての場所を挙げて報告する
- テストファイルが繰り返す本体を重複と数えない

## preset の適用範囲の検査

[`specs/preset-adoption.spec.ts`](specs/preset-adoption.spec.ts)

- すべてのワークスペースが preset の下にある設定を黙って通す
- preset のルールを止めている override を、届かなくなったワークスペースごとに挙げて報告する
- パスを絞らずに止めたルールは、すべてのワークスペースに届かないものとして報告する
- preset の外のルールを止めても報告しない
- ツールチェーンの設定が無いリポジトリでは適用範囲を検査しない

## 必須ファイルの形の検査

[`specs/required-file-form.spec.ts`](specs/required-file-form.spec.ts)

- JSON で置かれた knip の設定を、TypeScript の綴りを名指しして報告する
- JSON で置かれた oxlint の設定を、ツールチェーン設定へ移す指示とともに報告する
- 旧来の rc 形式で置かれた eslint の設定を報告する
- JavaScript で置かれた vite の設定を報告する
- リポジトリの根だけでなく、マニフェストを持つディレクトリに置かれた設定も報告する
- TypeScript で書かれた設定を報告しない
- AGENTS.md を持つディレクトリに CLAUDE.md が無いことを報告する
- CLAUDE.md が中身を持つ実体ファイルであることを報告する
- CLAUDE.md が AGENTS.md 以外を指すシンボリックリンクであることを報告する
- CLAUDE.md だけがあって AGENTS.md が無いことを報告する
- AGENTS.md を指すシンボリックリンクの CLAUDE.md を報告しない
- どちらの指示ファイルも無いディレクトリを報告しない
- マニフェストを 1 つも持たないリポジトリでも、根を開いた対象として数える

## 検査の走査証跡

[`specs/scan-trace.spec.ts`](specs/scan-trace.spec.ts)

- 観点ごとに、開いた対象の数を残す
- 対象を持てなかった観点に、開かなかった理由を持たせる
- 設定を持つリポジトリでは preset adoption を走査済みとして残す
- 人間が読む形では、状態の記号と対象の規模を観点ごとに桁で揃えて並べる
- AI が読む形では、記号も桁揃えも持たせずに 1 行 1 観点で並べる
- 違反を見つけた観点を、その件数とともに残す

## 出荷する skill と宣言した版の突き合わせ

[`specs/shipped-skill-versions.spec.ts`](specs/shipped-skill-versions.spec.ts)

- npm へ公開できるパッケージが skill の隣に changelog を持たなければ報告する
- changelog が宣言された版を書いていなければ、その changelog を指して報告する
- 同梱する skill が別の版を名乗っていれば、その skill を指して報告する
- changelog が版を書き、skill が同じ版を名乗っていれば何も報告しない
- 公開しないパッケージが skill の隣に changelog を持てば報告する
- 自動修正は skill の版を宣言へ揃え、changelog には触れない

## 計測の配線の検査

[`specs/telemetry-wiring.spec.ts`](specs/telemetry-wiring.spec.ts)

- 計測を宣言している test ブロックを黙って通す
- 計測を宣言していない test ブロックを、宣言を足す指示とともに報告する
- 宣言の途中までしか書かれていない test ブロックも報告する
- 宣言された計測が無効にされていても、宣言があるものとして通す
- test ブロックを持たない設定を報告しない
- ツールチェーンの設定を持たないワークスペースを報告しない
- マニフェストを持つディレクトリを、開いた対象として数える

## ツールチェーン設定の preset

[`specs/toolchain-preset.spec.ts`](specs/toolchain-preset.spec.ts)

- 呼び手が書いた除外パターンを、git 由来の除外の後ろに残す
- 除外を書いていない呼び手の設定にも、除外パターンの配列を与える
- markdown の段落を折り返さない整形を、呼び手が書かなくても与える

## ワークフロー定義の検査

[`specs/workflow-definitions.spec.ts`](specs/workflow-definitions.spec.ts)

- 解釈できない定義を、どの検査も素通りする前に場所を指して報告する
- ゲートとして要求されうるトリガが、自分の起動をパスやブランチで絞り込んでいたら報告する
- 呼び出される部品が、自分を起動するトリガを併せ持っていたら報告する
- 別のワークフローの結果を受けて起動する連鎖を報告する
- 権限を宣言しないまま既定の権限で走るジョブを報告する
- 1 つの実行ブロックに複数のコマンド呼び出しを詰めたステップを報告する
- 失敗を握りつぶす記述を実行ブロックに置けない
- タグで参照したアクションを報告する
- 固定はしたが版を書き添えていないアクション参照を報告する
- 履歴を全部取りにいくチェックアウトを報告する
- 固定した参照を引き上げる仕組みを持たないリポジトリを報告する
- 失敗を成功として報告させる continue-on-error を置けない
- すべての規律を守った定義を黙って通す
