# @mst/dont-review-it

生成物。`vp run guard:fix` が `specs/` の仕様担保テストから再生成する。手で編集しない。

## 値の正典の検査

[`specs/canonical-values.spec.ts`](specs/canonical-values.spec.ts)

- 同じ概念を 2 か所で宣言していたら、先に宣言した場所を挙げて報告する
- 同じ値の集合を別々の概念が宣言していたら、両方の概念を挙げて報告する
- 概念を名指ししない注釈を報告する
- 退役した注釈タグが残っていたら報告する
- テストファイルが繰り返す値の集合を二重宣言と数えない

## リポジトリ検査の入口

[`specs/check-entry.spec.ts`](specs/check-entry.spec.ts)

- check 以外の命令を名指しで拒否する
- 存在しない場所を検査対象に取らない
- 依存バージョンの食い違いを報告して失敗する
- test command が config を差し替える経路を報告して失敗する
- test command が coverage 設定を上書きするか対象を変更ファイルだけに絞る経路を報告して失敗する
- test entry が別 package へ委譲する経路と通常run以外のrunner引数を報告して失敗する
- test entry の前後に pretest と posttest の別経路を置く構成を報告して失敗する
- test config を持つ workspace の scripts.test 欠落と非文字列を報告して失敗する
- wrapper prefix が欠けた entry を報告して失敗する
- check --write が安全な entry composition を修復して再検査を通す
- check --write が本体の無い guard を生成せず問題として残す
- check --write が command body の空の guard を補完せず問題として残す
- check --write が他 layer の wrapper を自動修復せず問題として残す
- check --write が解釈できない manifest を書き換えず misuse として失敗する

## カバレッジのソース集合

[`specs/coverage-source-universe.spec.ts`](specs/coverage-source-universe.spec.ts)

- canonical test config の top-level root は値を評価する形でも報告し、副作用を自動削除しない
- 重複した top-level root は先行値を露出させず診断だけを返す
- 未importのproduction sourceを分母へ含め、CLIによる除外を問題にする
- changed選択では未変更のproduction sourceをcoverage gateから除外できない

## 依存宣言の検査

[`specs/dependency-declarations.spec.ts`](specs/dependency-declarations.spec.ts)

- ワークスペース定義の無いリポジトリでは依存を検査しない
- 解釈できないワークスペース定義を、どの検査も素通りする前に報告する
- 1 つのマニフェストしか使わない catalog エントリを報告する
- overrides が catalog: で参照するエントリは、使うマニフェストが 1 つでも通す
- catalog が持つバージョンをマニフェストが直接書き写していたら報告する
- 複数のマニフェストが catalog の外で同じバージョンを繰り返していたら報告する
- バージョンが食い違う宣言を、修正候補が一意でなくても問題として報告する

## 重複した宣言本体の検査

[`specs/duplicated-bodies.spec.ts`](specs/duplicated-bodies.spec.ts)

- 同じ本体を綴る宣言を、繰り返しているすべての場所を挙げて報告する
- テストファイルが繰り返す本体を重複と数えない

## 設定への git 除外の注入

[`specs/git-excludes.spec.ts`](specs/git-excludes.spec.ts)

- 呼び手が書いた除外パターンを、git 由来の除外の後ろに残す
- 除外を書いていない呼び手の設定にも、除外パターンの配列を与える

## ワークフロー定義の検査

[`specs/workflow-definitions.spec.ts`](specs/workflow-definitions.spec.ts)

- 解釈できない定義を、どの検査も素通りする前に場所を指して報告する
- ゲートとして要求されうるトリガが、自分の起動をパスやブランチで絞り込んでいたら報告する
- 呼び出される部品が、自分を起動するトリガを併せ持っていたら報告する
- 別のワークフローの結果を受けて起動する連鎖を報告する
- 権限を宣言しないまま既定の権限で走るジョブを報告する
- 1 つの実行ブロックに複数のコマンド呼び出しを詰めたステップを報告する
- 失敗を握りつぶす記述を実行ブロックに置けない
- 失敗を成功として報告させる continue-on-error を置けない
- すべての規律を守った定義を黙って通す
