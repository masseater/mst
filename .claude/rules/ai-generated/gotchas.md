---
paths:
  - "**"
---

# Vite+ (mst) の落とし穴

このリポジトリで実際に踏んだ、コードを読んでも分からない事実だけを記録する。一般的な TypeScript の書き方や Vite+ の基本的な使い方は扱わない。

各項目は「症状 → 原因 → 対処」で読める形にしている。

## git hook の中で走る git は、cwd ではなく継承した `GIT_DIR` を見る

- 症状: 一時ディレクトリに作った検証用リポジトリに対する git 操作が、共有リポジトリの側に当たった。`codex/feat-stop-ai-slop` の ref がテストの `snapshot` コミット列に進み、共有の `.git/config` に `user.email` / `user.name` / `diff.noprefix` / `diff.renameLimit` が書き込まれた。`git init` は `warning: re-init: ignored --initial-branch=main` だけを出して通る
- 原因: git は hook を起動するとき `GIT_DIR` / `GIT_INDEX_FILE` などを環境変数に置く。hook から派生したプロセスはこれを継承し、`cwd` を渡しても `GIT_DIR` のほうが勝つ。このリポジトリの `.vite-hooks/pre-commit` と `pre-merge-commit` は `vp run guard` を呼ぶので、guard が走らせるテストと検証コマンドはすべてこの環境の下にいる
- 気づけない理由: 手元で `vp run guard` を直接叩くぶんには `GIT_DIR` が無いので再現しない。hook 経由の 1 回だけ壊れる
- 対処: git を起動する側が環境を作り直す。`packages/stop-ai-slop/src/git-text.ts` は `GIT_` で始まる変数をすべて落としてから git を呼ぶ。検証用リポジトリを作る側はさらに強く、`PATH` と `HOME` と `GIT_CONFIG_GLOBAL` / `GIT_CONFIG_SYSTEM` だけを渡す。開発者の global 設定（`init.templatedir` など）も一緒に締め出せる

- IF: リポジトリのパスを引数で受け取って git を起動するコードを書く; THEN
  - MUST: `GIT_` で始まる環境変数を落としてから起動する
  - PROHIBIT: `cwd` を渡しただけで対象リポジトリが決まるとみなす
- IF: テストから git を起動する; THEN MUST: 同じ扱いにする
  - 検証用リポジトリのつもりの操作が、hook 経由で走ったときだけ本物のリポジトリに当たる

## npm 経由でグローバル導入した vp は `vp test` を壊す

- 症状: `vp test` および `vp run -r test` が `Vitest failed to find the current suite` で必ず失敗する。`vp check` は通ってしまうため、CLI の導入経路が原因だとは気づきにくい
- 原因: npm パッケージ版の vp は自分に同梱された vitest でテストを起動する。一方でテストファイル側はプロジェクトローカルの `vite-plus/test` を解決するため、vitest のインスタンスが二重になる
- 実測: mise の `npm:vite-plus@0.2.8` で失敗、公式インストーラのネイティブ vp 0.2.8 で成功、プロジェクトローカルの `./node_modules/.bin/vp` でも成功。バージョンは全て同一
- 上流: [voidzero-dev/vite-plus#2097](https://github.com/voidzero-dev/vite-plus/issues/2097)（OPEN）で「`npm -g install vite-plus` は簡単に実行できてしまうが、それは期待されるグローバル CLI ではない」と明言されている。警告を出す実装を検討中。公式ドキュメントもインストール手段として curl のインストーラしか案内していない

対処:

- IF: vp をグローバルに導入する; THEN
  - MUST: 公式インストーラ（`curl -fsSL https://vite.plus | bash`）を使う
  - PROHIBIT: mise の global config に `vp` エントリを置く

## テンプレートが入れる `vite` 直接依存を「未使用」と判断して消してはいけない

- 症状: knip がルートと `packages/repository-checks` の `vite` を未使用 devDependency として報告する。実際にソースからは参照されていない
- 消すとどうなるか: pnpm では `overrides` が実際の `vite` 依存エッジを持つワークスペースにしか効かない。直接依存のないワークスペースでは autoInstallPeers が上流の素の vite を別途インストールし、vite/vitest が二重インスタンス化する。これは前項と同じ構造の障害（`vp test` のキャッシュミス、dual instance）を招く
- 上流: [voidzero-dev/vite-plus#1932](https://github.com/voidzero-dev/vite-plus/issues/1932)。テンプレートが root と `packages/utils` に直接 `vite` 依存を入れているのは、まさにこの対策として入れられたもの
- 併せて必須の設定: `catalog` の `vite: npm:@voidzero-dev/vite-plus-core@<version>` エイリアスと `overrides.vite: "catalog:"`（[voidzero-dev/vite-plus#2034](https://github.com/voidzero-dev/vite-plus/issues/2034) でコラボレータが「想定どおり」と回答）。`peerDependencyRules` は機能上は任意で、外すと unmet peer の警告が出るだけ（[voidzero-dev/vite-plus#1021](https://github.com/voidzero-dev/vite-plus/issues/1021)）
- 対処: `knip.ts` の `ignoreDependencies` に `vite` を入れてある。これは「使っていないものを隠す」のではなく「knip の静的解析では見えない用途で使われている」ことを伝えるもの

- IF: knip が `vite` を未使用依存として報告した; THEN PROHIBIT: `vite` の直接依存または `ignoreDependencies` の指定を削除する
- IF: ローカルで `vp check` / `vp run -r test` / `vp run -r build` が全て通った; THEN PROHIBIT: それをもってこの種の破壊が起きていない根拠とする
  - 実際に `vite` 依存を削除しても、ローカルの検証は全て緑になった。この検証系はこの障害を検出しない

## Vitest の OpenTelemetry の `sdkPath` は Vitest の `root` から解決される

- 症状: `sdkPath: "./otel.ts"` と書くと、ワークスペースごとのテスト実行で `packages/<各パッケージ>/otel.ts` を探しに行って失敗する。ルートに置いたファイルは見つからない
- 原因: `resolved.experimental.openTelemetry.sdkPath` は `resolve(resolved.root, sdkPath)` される。各パッケージの `test` スクリプトはパッケージ直下で Vitest を起こすため、`root` はリポジトリのルートではなくパッケージのディレクトリになる
- 対処: 絶対パスを渡す。このリポジトリは `fileURLToPath(import.meta.resolve("@mst/ai-native/vitest-sdk"))` で解決している
- あわせて、`sdkPath` が指すモジュールは `shutdown` を持つオブジェクトを default export しなければならない。持たないと Vitest は警告を出すだけで進み、トレースは出ないまま終わる

- IF: `experimental.openTelemetry` を配線する; THEN MUST: 違反ではなく正の実行で、実際にトレースが受け皿へ届いたことを確かめる
  - 配線が効いていない状態は、テストが緑のまま「速いワークスペース」と同じ見た目になる

## Tempo のトレース検索は時間範囲を渡さないと 0 件を返す

- 症状: 計測したコマンドを実行した直後に検索しても空が返る。エラーは出ないので「計測が動いていない」と読んでしまう
- 原因: 検索は `start` と `end`（Unix 秒）を渡さないと投入したばかりのトレースに届かない。タグの値を引く経路も同じで、時間範囲なしでは実在するトレースがあっても空になる。取り込みにも数秒かかる

- IF: トレースが見つからない; THEN PROHIBIT: 検索が 0 件だったことを、計測が動いていない根拠とする

## knip は文字列で解決されるモジュールを追えない

- 症状: `import.meta.resolve("@mst/ai-native/vitest-sdk")` でしか参照されないファイルの default export が、`knip --production` で未使用として報告される
- 原因: 参照が静的な import ではなく文字列なので、静的解析からは誰も使っていないファイルに見える。`includeEntryExports: true` を立てていると、entry のエクスポートまで検査対象になる
- 対処: `knip.ts` の該当ワークスペースの `ignore` に入れてある。使っていないものを隠すためではなく、knip の静的解析では見えない経路で使われていることを伝えるもの

## `vp pack` の `pack.exports: true` は package.json の exports を書き換える

- 症状: `vp pack` を実行すると package.json の `exports` フィールドが自動生成で上書きされ、手書きで足したサブパス export（例: `"./tsconfig/*": "./tsconfig/*"`）が消える
- 原因: `pack` ブロックは tsdown の設定そのもので、`exports` は tsdown の機能。CLI ヘルプ上も experimental 扱い
- 対処: tsdown の `customExports` を使う。オブジェクト形式が [rolldown/tsdown#767](https://github.com/rolldown/tsdown/issues/767) / [PR #769](https://github.com/rolldown/tsdown/pull/769) で入っている

```ts
pack: { exports: { customExports: { './tsconfig/*': './tsconfig/*' } } }
```

- 上流に vite-plus 側の issue は存在しない

## vp は内部で pnpm を使っている

叩くコマンドは `vp` だけだが、実体は pnpm である。

- `vp env current` は Package Manager として pnpm（Source: `devEngines.packageManager`）を報告する
- `vp install` の出力は `Done in ... using pnpm v11.20.0` と表示する
- リポジトリには `pnpm-lock.yaml` と `pnpm-workspace.yaml` がある

したがって pnpm 固有の依存解決の挙動（前項の autoInstallPeers など）はこのリポジトリにそのまま該当する。

## テンプレートが置くパッケージのメタデータはプレースホルダである

- 該当箇所: `"author": "Author Name <author.name@mail.com>"`、`"repository.url": "git+https://github.com/author/library.git"`、`"homepage": "https://github.com/author/library#readme"`、`"bugs.url": "https://github.com/author/library/issues"`、`"description": "A starter for creating a TypeScript package."`
- 出自: Vite+ のテンプレートが [sxzz/tsdown-templates](https://github.com/sxzz/tsdown-templates) の default テンプレートを取り込んだもの。vite-plus の CLI スナップショットテストで期待値として固定されているため、テンプレートの未整備ではなく既知の出力
- 上流に issue はなく、公開リポジトリでもそのまま残している例が複数ある
- IF: テンプレートが生成したパッケージを publish する; THEN MUST: これらを実際の値に書き換える

## catalog に寄せるときは catalog 側の値が実態と合っているか確認する

- 症状: knip の「未使用 catalog エントリ」を解消するため、ワークスペースの直書きバージョンを `catalog:` に変えたところ、`vite-plus` と `vitest` がそれぞれ `1 version, 2 instances` に分裂した
- 原因: catalog の `@types/node` が `^24` のままだったため `packages/utils` だけ 24 系に解決され、26 系に解決されるルート・`apps/website` と peer が食い違った。テンプレートがワークスペース側に `^26.1.1` を直書きしていたのは、この整合を取るためだった
- 検出方法: `vp check` / `vp run -r test` / `vp run -r build` はすべて緑のままなので、これらでは気づけない。`vp why <パッケージ名>` が `Found 1 version` を返すか、`Found 1 version, N instances` を返すかで判断する
- 対処: catalog 側の値を実態に合わせる（`^24` → `^26`）。ワークスペース側を直書きに戻すと catalog エントリが未使用になるため、catalog 側を上げるのが筋

- IF: ワークスペースの依存を `catalog:` 参照に変える; THEN MUST: 変更後に `vp why` で単一インスタンスを保っていることを確認する

## `lint.plugins` を書くと既定のプラグインが消える

- 症状: vitest プラグインを有効にしたくて `lint.plugins: ["vitest"]` と書いたところ、`unicorn` / `typescript` / `oxc` の 53 ルールが無効になった。`vp check` は緑のままなので気づけない
- 原因: `plugins` は追加ではなく置換である。oxlint の型定義にも「Setting the `plugins` field will overwrite the base set of plugins」と書かれている。既定は `["unicorn", "typescript", "oxc"]`
- 検出方法: `vp lint --print-config` が解決後の `plugins` と全ルールを吐く。設定変更の前後で取って diff を取ると、消えたルールが行として見える
- 対処: 既定を明示して足す（`["unicorn", "typescript", "oxc", "vitest"]`）

- IF: `lint.plugins` を触る; THEN MUST: 変更前後で `vp lint --print-config` を diff し、差分が追加だけであることを確認する

## `vitest/consistent-test-filename` の `pattern` は素直に書くと壊れる

テストの配置規約（対象ソースと同じディレクトリに `<ソース名>.test.ts`）は、ルートの `vite.config.ts` でこのルールを使って強制している。実装は [oxc の consistent_test_filename.rs](https://github.com/oxc-project/oxc/blob/367f730a7b578d24e8106713abaf517304b6b655/crates/oxc_linter/src/rules/vitest/consistent_test_filename.rs) にあり、設定を書くときに引っかかる仕様が3つある。

- **`pattern` を `/` で始めると正規表現リテラルとして解釈され、黙って別物になる**
  - 症状: `pattern: "/src/.*\\.test\\.tsx?$"` と書いたら、診断の help に出るパターンが `src` だけになり、パスに `src` を含むファイルが何でも通るようになった。エラーにはならないので気づけない
  - 原因: `compile_matcher_pattern` が「`/` 始まりなら `/pattern/flags` 形式」とみなし、`strip_prefix('/')` した文字列の**最後の `/`** で切る。`src/.*\.test\.tsx?$` の最後の `/` は `src` の直後なので、パターンが `src`、フラグが `/.*\.test\.tsx?$` に割れる
  - 対処: `/` で始めない。パス区切りを先頭に置きたいときは `[/]` と書く
- **マッチ対象は絶対パス全体**
  - `ctx.file_path()` をそのまま `is_match` にかける。`^packages/` のようなリポジトリルート起点のアンカーは一致しない（`^/Users/` は一致する）
  - 裏返しとして、チェックアウト先のパスに `tests/` のような文字列が含まれるとパス判定が意図せず動く可能性がある
- **先読みが使えない**
  - `lazy_regex`（Rust の `regex` crate）なので `(?!...)` が書けない。「`tests` セグメントを含まない」を `pattern` 単体では表現できない
  - そのため設定は2段構えにしている。ベースの `rules` で命名（`\.test\.tsx?$`）だけを見て `.spec.ts` を弾き、`overrides` の glob でテスト用ディレクトリを捕まえて到達不能な `pattern` を与えて必ず error にする
  - `overrides` 側の `pattern` に置いた `place-the-test-file-next-to-its-source-instead-of-a-test-directory` は、正規表現として意味を持たせるためではなく、help 行が `Rename the file that match the pattern (?u)place-the-test-file-next-to-its-source-instead-of-a-test-directory` と読めて直し方が伝わるようにするための文字列

- IF: `vitest/consistent-test-filename` の `pattern` を変更する; THEN MUST: 変更後に違反ファイルを実際に置いて error になることを確認する
  - このルールは条件に合わなければ黙って何も言わない。設定ミスは「lint が緑」として現れるため、正のケースだけでは検出できない

さらに、このルールが見るのは oxlint が `*.test.*` / `*.spec.*` という名前からテストファイルと見なしたものだけである。`text.checks.ts` のような任意の名前に置かれたテストは、`test` を呼んでいても一切報告されない。このルールで守れるのは「テストらしい名前どうしの選別」であって、「テストを別の名前のファイルへ置く」ことは防げない。

- IF: `vitest/consistent-test-filename` に「テストはこの名前だけ」を守らせたい; THEN PROHIBIT: テストらしくない名前のファイルの検出を期待する
  - 検証に使うと無反応が「合格」に見える。実測するときは `*.test.*` / `*.spec.*` の名前の中で違反させる

## `vp lint --print-config` は jsPlugin のルールを解決しない

- 症状: 自前ルールを base preset に追加した前後で `vp lint --print-config` を取って diff したところ、差分が 1 行も出なかった。ルールは実際に有効になっていて、違反ファイルを置けば error が出る
- 原因: `--print-config` が吐くのは組み込みルールの解決結果だけである。`jsPlugins` の欄にはルートの `vite.config.ts` が直接書いた `vite-plus` しか現れず、`extends` した先（`@mst/dont-review-it` の preset）が宣言した jsPlugin もそのルールも出てこない。`rules` の欄に `dont-review-it/...` が現れるのは、ルート側の `overrides` が名指しで off にしている 2 本だけ
- したがって、この diff は自前ルールの増減については常に空になる。「差分が追加だけだった」を配線の確認として読むと、何も確認していないことになる

- IF: 自前ルールを追加・削除して配線を確認したい; THEN
  - MUST: 違反する現物をリポジトリ内に置き、`vp lint <その パス>` が該当ルールの error を出すことを確認する。確認後にそのファイルを消す
  - PROHIBIT: `vp lint --print-config` の diff が空であることをもって、ルールが有効になった根拠とする
- IF: `lint.plugins` を触った; THEN MUST: 引き続き `--print-config` の diff を取る
  - 組み込みプラグインの置換（前項）はこの出力に現れる。`--print-config` が役に立つのはそちらの用途である

## `extends` した設定の `ignorePatterns` は捨てられる

- 症状: preset に `ignorePatterns` を書いても 1 件も効かない。同じ 1 行をルートの `vite.config.ts` の `lint` に移すと効く。エラーも警告も出ない
- 原因: oxlint の [`Oxlintrc::merge`](https://github.com/oxc-project/oxc/blob/367f730a7b578d24e8106713abaf517304b6b655/crates/oxc_linter/src/config/oxlintrc.rs) が `self`（`extends` を書いた側）の `ignore_patterns` だけを残し、`extends` で名指しした設定のものを読まない。`rules` / `overrides` / `plugins` / `options` は継承されるため、この 1 フィールドだけが例外になっている。`settings` / `env` / `globals` も同じ扱い
- 対処: `defineConfig` に直接渡すオブジェクト自身に持たせる。このリポジトリでは `@mst/dont-review-it` の `dontReviewItPreset.lint(...)` が注入し、忘れると `no-unwrapped-toolchain-config--call-the-preset-for-the-block` が報告する

- IF: preset から何らかの設定を配れているか確かめる; THEN MUST: そのフィールドが `extends` で継承されるかを実測する
  - 継承されないフィールドは、書いても何も起きず lint は緑のまま通る

## oxlint と oxfmt が見ない git の ignore は `core.excludesFile` だけ

- 症状: `core.excludesFile` が指すファイルに書いたパターン（`.agents/` など）が lint と format の除外に効かない
- 原因: 走査を組み立てる [`configure_walk_builder`](https://github.com/oxc-project/oxc/blob/20f68e74a3fddb4049fe33629be9bf91e14a4baa/crates/oxc_config/src/walk.rs#L16-L35) が `git_global(false)` を立てている。同じ関数が `git_ignore(true)` / `git_exclude(true)` / `parents(true)` を立てているため、リポジトリの `.gitignore`（ネストしたものと親側を含む）と `$GIT_COMMON_DIR/info/exclude` は尊重される。リンクした worktree の中でも `info/exclude` は解決される（上流に同名のテストがあり、こちらでも実測した）
- 上流: 意図的な非対応である。[公式ドキュメント](https://oxc.rs/docs/guide/usage/linter/ignore-files.html)に `global gitignore files are not respected` と明記があり、[oxc#14926](https://github.com/oxc-project/oxc/issues/14926) は「開発者ごとに検査対象が変わるのは紛らわしい」として NOT_PLANNED で閉じられた。[oxc#22155](https://github.com/oxc-project/oxc/issues/22155) が `$XDG_CONFIG_HOME/git/ignore` の対応を求めて OPEN のまま残っている
- 検出方法: 片方の経路だけが拾うパスに違反ファイルを置き、`vp lint` と `vp fmt --list-different` にかける。`git check-ignore -v` でどの経路が拾っているかを先に確かめる
- 対処: `@mst/dont-review-it` の `dontReviewItPreset` が 3 経路すべてを読んで `ignorePatterns` に変換する。埋めたい穴はグローバルの 1 経路だけだが、残り 2 経路も読む。順序はグローバル → `$GIT_DIR/info/exclude` → リポジトリの `.gitignore` で、gitignore は last-match-wins なので、この順でないと `!` による再包含が負ける。経路をまたぐ再包含は 1 か所で並べないと表現できない

## oxlint がルールに渡す AST に `ParenthesizedExpression` は現れない

- 症状: 括弧を剥がすヘルパを書いても、その再帰の分岐に一度も入らない。`vp lint` は緑のまま通り、剥がす処理が要らないことに気づけない
- 原因: `oxc-parser` を直接呼ぶと `export default ({ a: 1 })` は `ParenthesizedExpression` を生成する。oxlint が JS プラグインに渡す AST では括弧が落ちている。同じ AST 定義を共有しているため型には現れ続ける
- 実測: 括弧付きの設定 (`export default ({...})`)、括弧付きの数値 (`branches: (100)`)、括弧付きの転送呼び出しの 3 通りをテストに置き、いずれもヘルパの再帰に入らないことをカバレッジで確認した。ヘルパと 16 か所の呼び出しを削除しても 983 件のテストは全て通った
- 対処: ルールの中で括弧を剥がさない

- IF: ルールの中で `ParenthesizedExpression` を扱おうとしている; THEN PROHIBIT: 書く
  - 型に現れるのは AST 定義の共有によるもので、oxlint 経由では到達しない
- IF: パーサの出力そのものを扱うコード（`parseSync` を直接呼ぶ側）を書いている; THEN MUST: 括弧を考慮する
  - こちらには実際に現れる

## 生成される lint ルール索引の「設定可能」印は、schema がその場に書かれていないと付かない

- 症状: オプションを受け取るルールを書いたのに、`docs/lint/index.md` の設定可能を示す列が空のまま生成される。ルールは実際にオプションを読んでいて、テストも通る
- 原因: 索引の事実を抽出する `packages/lint-rule-authoring/src/rule-index/rule-facts.ts` は、`meta.schema` がその場に書かれた配列リテラルで、要素が 1 つ以上あるときだけ設定可能と判定する。定数へ括り出して参照すると識別子として読まれ、要素数が数えられない。抽出はルールのファイル 1 つを `oxc-parser` で読むだけなので、別モジュールから import した定数は解決しようがない
- 波及: `name` と `docs.description` は同じファイル内の `const` なら解決される。`schema` だけがこの解決を通らない
- 実測: `require-catalog-entry--register-shared-dependency` は `CATALOG_ENTRY_SCHEMA` を別モジュールから import していて、オプションを 2 つ持つのに索引の印が付いていない
- 対処: schema はルールのファイルに配列リテラルとして直接書く

- IF: ルールの `meta.schema` を別モジュールの定数から渡そうとしている; THEN PROHIBIT: 渡す
  - 索引が「設定を持たないルール」として生成され、lint も検査も緑のまま通る
