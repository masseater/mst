# 0052. runner 引数を転送する root の test 呼び出しも検査する

- ステータス: Accepted
- 日付: 2026-08-13

## 文脈

[0047](0047-make-the-coverage-source-universe-explicit.md) は、各 package の `scripts.test` が自動発見される設定と production source 全体を使うことを静的に検査する。一方、Vite+ の `vp run [task] [additional arguments]` は task 名より後ろの引数を task command へ転送する。package の定義が安全でも、root の recursive test 呼び出しが `--changed`、`--config`、coverage override、test file path を追加すれば、同じ Vitest parser がその引数を受け取り、検査済みの実行対象と source universe を変えられる。

[0051](0051-run-workspace-test-pools-one-at-a-time.md) は workspace の同時実行数を 1、各 Vitest の worker 数を 2 に固定した。この上限も root だけが所有する転送引数であり、package の `scripts.test` からは存在も値も証明できない。

`guard` は上限と出力保持の wrapper を 1 回だけ適用し、`guard:all` がすべての stage を持つ 2 段構成である（[0036](0036-fix-the-wrapper-prefix-per-layer-and-check-it-where-manifests-are-checked.md)）。test stage だけを検査しても、`guard` が別 entry へ委譲するか、`guard:all` の control operator が test stage を飛ばせるなら、実際の gate を証明したことにならない。

## 決定

**test 実行経路の検査は root manifest の `guard` と `guard:all` も読む。** `guard` は `throttle --timeout 1800 -- spool -- vp run guard:all` の 1 command だけとし、別 command、追加引数、別 entry への委譲を禁止する。

**`guard:all` は静的に解釈できる空でない command を `&&` だけでつないだ chain とする。** `||`、`;`、pipe、background、改行による分割、末尾 operator、parameter・command・pathname・brace expansion は、test gate が必ず同じ形で実行されることを証明できないため失敗させる。他の stage の並びはこの検査で固定しない。

**recursive test stage は `vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2` をちょうど 1 回、直接置く。** task selector より前は全 workspace を依存順に 1 つずつ実行する指定へ固定する。task selector より後ろは package script へ転送されるため、静的設定で宣言した coverage を有効にする `--coverage` と worker budget の `--maxWorkers 2` だけを許す。config、coverage source universe、test subset、run modeを変える追加引数、別 script や wrapper を介した実行、直接の `vp test` / `vitest`、欠落と重複を失敗させる。

この検査は既存の `test-execution` 観点へ含め、走査数は従来どおり開いた manifest 数とする。root manifest を別の単位として二重に数えない。`guard:all` に残す他の stage と順序は一意に決まらないため、自動修正は持たず、診断に正規の wrapper と test stage をそのまま示す。

## 影響

- package の `scripts.test` と root から転送される引数の両方が安全な場合だけ、coverage gate が通る。
- root から `--changed`、`--config`、coverage override、test pathを追加しても、各 package の安全な test scriptを迂回できない。
- workspace 数やホストの CPU 数が変わっても、guard が同時に起動する Vitest は 1、各 Vitest の worker は最大 2 のままになる。
- `guard:all` に別の品質 stage を追加・削除できるが、test stage を別 entryへ隠したり、control flowで省略可能にしたりできない。
- 走査証跡の check 名、単位、件数は変わらない。

## 検討して採らなかった案

**各 package の `scripts.test` だけを検査する。** Vite+ が root から転送する additional arguments は package manifest に現れず、実行時の runner 設定を証明できないため採らない。

**root の test stage にある危険な引数だけを列挙して禁止する。** Vitest と Vite Task が新しい引数を追加するたびに、安全性を未評価の引数が許可側へ入る。許可する selector と転送引数を有限集合へ固定できるため採らない。

**実行時に process arguments を記録して検査する。** 実際に起動した workspace しか観測できず、control flowで省略された test stageを安全な実行と区別できない。commit された gate 定義を静的に検査できるため採らない。
