---
description: Machine-enforced checks for recurring low-value patterns in AI-authored changes.
---

# @mst/stop-ai-slop

## このパッケージが守るもの

AI が変更へ付け足しやすい、動作上の価値を持たないコードを機械的に見つけられる状態。

検査対象は、変更前後の静的な事実から一意に決まるものに限る。変更理由、依頼文、自然言語の類似から意図を推測しない。初期の検査は、削除された対象と、その不存在を新しく固定する検査の完全な対応だけを扱う。

## CLI

公開コマンドは `stop-ai-slop check` だけである。このコマンドが、登録済みの検査機能を定義順にすべて実行する。

- IF: 検査機能を追加する; THEN
  - MUST: `src/check-registry.ts` の順序付き一覧へ登録する
  - MUST: 同じ `check` コマンドから実行されることをテストする
  - PROHIBIT: 機能専用のサブコマンドを公開する
    - 利用者が検査機能の増減を知り、実行コマンドを更新する状態を作らない

## 検出境界

- IF: 新しい検査対象を定義する; THEN MUST: 変更前から消えた対象と変更後に増えた検査を静的な locator で関連付ける
- IF: locator を完全に復元できない; THEN PROHIBIT: 名前や文字列の一致だけで問題として報告する
  - 同名の別モジュールや説明文を誤って止めない
- IF: parser、Git、revision、source の読み取りが失敗した; THEN MUST: 利用エラーとして終了する
  - 読み取れなかった変更を問題なしとして扱わない
- IF: 検査機能内に複数の報告がある; THEN MUST: 安定した順序で返す
- IF: 問題として報告する構文を追加する; THEN
  - MUST: 実 Git 履歴を使う検出テストを先に追加する
  - MUST: 同名だが対象外となる境界テストを先に追加する

## 強制度

- IF: locator が一致する問題を検出した; THEN MUST: 終了コード 1 を返す
- IF: 問題の抑制を求められた; THEN PROHIBIT: allowlist、severity、ignore option を追加する
  - 誤検知する構文は既定の検出対象から外し、決定可能な境界を狭く保つ
