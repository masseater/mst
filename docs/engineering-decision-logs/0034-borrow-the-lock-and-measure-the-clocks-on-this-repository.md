# 0034. 排他は OS 所有のファイルロックに委ね、時間量はこのリポジトリで実測して決める

- ステータス: Accepted
- 日付: 2026-08-12

## 文脈

`@mst/ai-native` の `throttle` は、同一ホスト × 同一名前空間でラッパーの同時実行数を上限以下に保つ。この保証は、保持者が正常終了した場合だけでなく、強制終了した場合にも次の競合者が安全に取得できて初めて成立する。

ディレクトリの存在と mtime で lease を表す `proper-lockfile` 4.1.2 は、失効を判定した競合者が古いディレクトリを削除するまでの間に別の競合者が新しいロックを取得すると、その新しいディレクトリを削除して同時保持を許す競合を持つ。上流 [moxystudio/node-proper-lockfile#121](https://github.com/moxystudio/node-proper-lockfile/issues/121) は 2026-08-13 時点で未解決であり、失効回収を通常経路に含めたまま採用できない。

一方で、待機予算・打ち切り時間・同時保持数といった時間量と定員は、このマシンでこの作業がどれだけかかるかに張り付いており、ライブラリからも一般論からも導けない。

## 決定

**排他プリミティブは `fs-native-extensions` 1.5.0 の非待機 OS ファイルロックに委ねる。** Linux は open-file-description lock、macOS は `flock`、Windows は `LockFileEx` を使う。競合だけを `tryLock` の `false` として扱い、ファイルを開けない、または OS ロック操作に失敗した場合は元のエラーを透過する。保持する file descriptor が閉じられると OS がロックを解放するため、正常終了・例外・SIGKILL のいずれでも失効時間を待たず再取得できる。単一のmanifestだけが利用するためversionは`packages/ai-native`へ直接固定する（[EDR 0028](0028-keep-the-catalog-for-shared-versions-only.md)）。

ロック対象ファイルは作成後に削除・改名・置換しない。同じpathの別inodeを作ると、古いinodeの保持者と新しいinodeの保持者が同時に成立するためである。スロット領域は `throttle` 専用とし、保持中の一時ファイル清掃も禁止する。OSロックはadvisoryなので、すべての競合者がこの同じ経路を使うことを前提とする。

取得世代は別のmarkerに128 bitのランダム値として記録し、待機中の進捗表示を重複排除する。書込みと読取りの途中値を許容する表示用の識別子であり、排他の所有権やfencing tokenには使わない。旧実装と同じ `.lock` pathを維持し、旧実装のdirectoryが残っている場合は新実装の初期化を失敗させる。新実装の通常fileがある場合も旧実装の取得・失効回収は失敗する。全旧processを終了して旧lock directoryが解放された後に切り替え、異なる排他方式を同時に動かして上限を破らない。

この保証はホストローカルのファイルシステムに限定する。NFS・SMBなど、各OSのローカルファイルロック契約を同じ意味で提供しない領域は対象外とする。Nodeのpermission modelを使う実行ではnative addonの許可も必要になる。

**既定値はこのリポジトリの実測から決めた。**

- 同時保持数 1。`guard` は利用可能な全スレッドを使い切る設計で、テストスイートを 2 本並走させただけでワーカーが SIGKILL（exit 137）で落ちる事象をこのマシンで観測した。定員 2 では守れない。
- 待機予算 900 秒。`guard` 1 本の所要（数分）に、先行 1 本の完走を待つ余裕を足した値。
- 打ち切りの既定は 0（打ち切らない）。値を課すのは結線側で、`guard` には所要の数倍にあたる 1800 秒を指定する。
- 強制終了までの猶予 5 秒。後始末を持つツールチェーンの退出には足り、利用者が設定した打ち切りを実質的に延ばさない。

`--timeout` と実行中の割り込みは process tree 全体を対象にする。POSIX は `detached` child を process group leader として起動し、負の PID へ SIGTERM、5秒後に SIGKILL を送る。Windows は負の PID による process group signal を提供せず、Node core の cross-platform `killTree` も [nodejs/node#64406](https://github.com/nodejs/node/issues/64406) で未実装なので、OS 標準の `taskkill /PID <pid> /T /F` を使う。Windows の signal は元から穏当な終了要求にならないため、猶予を置かず tree 全体を即時強制終了する。tree 終了に失敗した場合は root process の終了も試し、tree 全体を終了できなかった事実を stderr に残す。

環境からの上書きは同時保持数のみ `MST_THROTTLE_LIMIT` で受ける。リポジトリの環境変数の語彙は有効化を表す 1 語だけという方針（[EDR 0021](0021-measure-our-own-lint-rules-and-let-the-user-choose-the-sink.md)）に、ホスト側の事情で変わる値の口を 1 つ加えた形である。無効値は既定へフォールバックし、書き間違いを「重いコマンドが一切動かない」に変換しない。

## 影響

- 時間量の根拠がこのリポジトリの観測に固定されたので、別のリポジトリへ持ち出すときは同じ実測をやり直す前提になる。
- crash後の回収はwall clockとmtimeに依存せず、OSがprocessのdescriptorを閉じた時点で行われる。生きている保持者から時間経過だけを根拠に奪わないので、同時保持数の上限を優先する。
- native addonの配布対象であるNode 26のmacOS・Linux・Windowsと、それぞれのx64・arm64を支持範囲とする。musl、Alpine、ネットワークファイルシステムは支持範囲に含めない。
- `proper-lockfile` 4.1.2の継続、同Issueをrenameで回避するfork、Node 26のprebuildを持たない `fs-ext-extra-prebuilt` は採用しない。
- `release` は同じPromiseを返す冪等操作とし、`unlock` と `close` をそれぞれ一度だけ試す。どちらかが失敗すれば失敗し、両方が失敗した場合は双方を一つの `AggregateError` に保持する。`close` に失敗したdescriptorはprocess終了までlockを保持し得る。
- 明示的な`release`に失敗した実行は、子commandが成功していてもstderrへwrapper自身の失敗を出し、終了code 1を返す。子commandも失敗した場合は双方の理由をstderrへ出す。
