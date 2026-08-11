# no-floating-promise--await-the-result

## 何を検出するか

promise を生む式のうち、その値がどこにも接続されていないもの。接続とは次の 4 つを指す。

- `await` されている
- `return` されている（接続を呼び出し元に委ねる）
- 束縛に代入され、その束縛が後で上のいずれかに到達する
- `Promise.all` などの合成に渡され、その合成の結果が上のいずれかに到達する

報告する形は 4 つで、報告メッセージも 4 つに分かれている。書き換える場所が形ごとに違うためである。

| 形                                                                 | messageId                  | 何が起きているか                                       |
| ------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------ |
| `fetchUser();`（呼び出しが文として単独）                           | `floatingPromiseStatement` | 値を捨てる位置に非同期呼び出しが置かれている           |
| `runEach(async (name) => { ... })`（同期戻り値のコールバック位置） | `floatingPromiseCallback`  | 受け取る側が待たないので、失敗は必ず落ちる             |
| `void fetchUser();`                                                | `voidedPromise`            | 待たない意図の表明であって、接続ではない               |
| `widened();`（宣言型が `any` / `unknown`、実体は非同期）           | `widenedAsyncCall`         | 型が広がっていても、たどり着く宣言は非同期のままである |

### promise を生む式の判定

型チェッカは使わない。oxlint の JavaScript プラグインには型情報が渡らないので、判定は **宣言の読み取り** で行う。呼び先を単一代入の束縛としてたどり、次のいずれかに当たれば promise を生むとみなす。

- たどり着いた関数宣言が `async` である
- たどり着いた宣言の戻り値の型注釈が `Promise` / `PromiseLike` / `Thenable` を名指ししている。合併型・交差型はいずれかの構成要素が名指ししていれば当たる
- 束縛の型注釈が関数型で、その戻り値の型が上を名指ししている
- `new Promise(...)`
- `Promise.all` / `Promise.allSettled` / `Promise.any` / `Promise.race` / `Promise.resolve` / `Promise.reject` / `Promise.try` の呼び出し

丸括弧・省略可能連鎖・非 null アサーション・インスタンス化式は、値がどこへ届くかを変えないので、辿って内側で判定する。型アサーションは、アサート先が `any` / `unknown` なら **型を広げたという事実** を持ったまま内側をたどり続け（4 番目の形）、それ以外の型なら内側の宣言をそのまま使う。

`void` で包んだ形（3 番目）だけは、呼び出しでない式も対象になる。`void` は必ず値を捨てるので、束縛が後で待たれる可能性を考える必要が無い。型注釈が promise を名指ししている束縛と、初期化子が promise を生む呼び出しである束縛の両方を報告する。

単一代入は [no-reassign--use-spread-or-iife](./no-reassign--use-spread-or-iife.md) が保証している。だから宣言から辿るだけで束縛の最終値が確定し、この判定に到達可能性の解析は要らない。

### 報告しない形

- 上の 4 つの接続のいずれかを持つ promise
- 同期的な関数の呼び出し。promise を生まない型は対象にならない
- `await` した結果に対する後続の操作。すでに接続済みである
- 非同期関数の定義そのもの。見るのは呼び出し位置と受け渡し位置だけである
- コールバック位置のうち、受け取る側の引数が promise を返す関数型を宣言しているもの。受け取る側が待つと宣言している
- コールバック位置のうち、引数の型注釈が無い・関数型でない・戻り値が `any` / `unknown` であるもの。同期的な戻り値を宣言していると確定できない
- 残余引数の位置と、スプレッドで渡した引数。どの宣言位置に着地するかが確定しない

意図的に待たない呼び出しを明示する手段は、まだ決まっていない。決まるまでこの例外に該当する形は存在せず、実装は例外を一切受理しない。

## なぜそれが要るか

守っている不変条件は「非同期の呼び出しは、その結果が呼び出し元の制御フローに接続されている」ことである。ある非同期呼び出しを目にしたとき、その失敗がどこで受け止められるかは、呼び出し位置から外側へ構文木をたどれば確定する。「結果は要らない」という要求もこの不変条件の外には出ない。要らないなら要らないと明示的に書き、そのうえで失敗経路の行き先を決める。

このルールが要る理由は 2 層ある。

1 層目は、[no-promise-chain--use-async-await](./no-promise-chain--use-async-await.md) が作る直接の帰結である。チェーン形式を禁じると、チェーンを消す最も安い方法は `.catch()` ごと消すことになる。残るのは **失敗処理を持たず、かつ待たない呼び出し** で、この形はチェーンではないので同ルールの検出条件に当たらない。担当を置かなければ、チェーンを禁じたことが失敗処理を丸ごと消す方向へ書き手を押し出すだけになる。禁止が別の穴を作る形であり、これは元の状態より悪い。

2 層目は、その形が読み手からも機械からも見えないことである。待たない呼び出しは同期的な文と見分けがつかず、その失敗は呼び出し元のどの `catch` にも届かない。処理系によっては警告すら出ず、失敗が観測されないまま処理が続く。no-promise-chain--use-async-await が「失敗経路を `catch` 節という 1 箇所へ集約し、そこを別のルールが検査できる状態を作る」ためにあるなら、集約から漏れる経路を残すことはその設計目的そのものを崩す。

このルールは単体で有効化しない。同じ不変条件を分担する束の 1 本であり、委譲先が無効な構成では、委譲元は「その形を検出しない」と宣言しただけの状態になる。

## どう直すか

結果をどう扱いたいかで 4 つに分かれる。

**結果が要る。** `await` して、後続の文がその値を使う。

```ts
const load = async (repositoryRoot: string): Promise<BodyIndex> => {
  const index = await buildRepositoryBodyIndex({ repositoryRoot });
  return index;
};
```

**呼び出し元に委ねる。** `return` する。接続を決めるのは呼び出し元になる。

```ts
const load = (repositoryRoot: string): Promise<BodyIndex> =>
  buildRepositoryBodyIndex({ repositoryRoot });
```

**複数を並行に走らせる。** 合成に渡し、合成の結果を `await` する。個々の呼び出しは合成に接続され、合成は `await` に接続される。

```ts
const loadBoth = async (roots: readonly string[]): Promise<readonly BodyIndex[]> =>
  await Promise.all(roots.map((repositoryRoot) => buildRepositoryBodyIndex({ repositoryRoot })));
```

**本当に結果が要らない。** 要らないのは **結果** であって **失敗** ではない。`await` して `try` / `catch` で受け、失敗の行き先をその場で決める。何を決めるかは [no-discarded-failure--receive-and-surface-it](./no-discarded-failure--receive-and-surface-it.md) と [no-logged-and-continued-failure--stop-or-recover](./no-logged-and-continued-failure--stop-or-recover.md) が扱う。

コールバック位置（`floatingPromiseCallback`）は、受け取る側を直す。引数の型を promise を返す関数型として宣言し、受け取る側で `await` する。待てない位置なら、コールバックを同期的なものに戻す。

自動修正は提供しない。`await` の挿入は囲む関数を `async` にする必要があり、評価順序も変わる。

## 禁じる回避策

いずれも「不変条件は満たさないが検出だけをすり抜ける」ものである。検出できないことは、書いてよいことを意味しない。

- 結果を使わない束縛に受ける（`const ignored = fetchUser();` を置いて、その束縛をどこでも待たない）。判定は値を捨てる位置に置かれた呼び出しで行うので報告は消えるが、失敗の行き先が無いことは変わらない
- 束縛だけを文として置く（`const pending = fetchUser();` の後に `pending;`）。同上
- `void` 演算子で包む。3 番目の形が報告する。包むことは接続ではない
- 空のハンドラをチェーンで足して形を整える。[no-promise-chain--use-async-await](./no-promise-chain--use-async-await.md) が報告する
- 非同期関数を同期的なコールバック位置へ渡して呼び出し文を消す。2 番目の形が報告する
- 戻り値の型を `any` / `unknown` に広げて判定から隠す。4 番目の形が報告する
- 型注釈を持たない引数のコールバック位置へ逃がす。引数の宣言が読めないので報告は消える。受け取る側に型を書くのが対になる作業である
- 依存パッケージの組み込みメソッドへ逃がす（`items.forEach(async (item) => { ... })`）。組み込みの宣言はソースから読めないので報告は消える。この形は、待たない呼び出しが最も出やすい位置である
- 非同期関数を別モジュールへ移し、import した名前で呼ぶ。判定はこのファイルの中で宣言を辿るので、import した名前の実体は読めない
- 抑制ディレクティブ。[no-silent-suppression--fix-or-justify-inline](./no-silent-suppression--fix-or-justify-inline.md) と [no-inline-suppression-of-protected-rule--register-the-exception-in-configuration](./no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.md) が受理条件を持つ

## オプション

取らない。有効か無効かだけを設定側で決める。

「このファイルでは待たなくてよい」「このモジュールは対象外」といった条件付けを設定として持たせると、失敗が落ちる場所を設定ファイルが決めることになり、読み手は呼び出し位置を見ても失敗の行き先を判定できなくなる。判定に使う `Promise` / `PromiseLike` / `Thenable` の綴りと、promise を生む静的メソッドの一覧はルールが持つ。別の綴りの thenable を入れたなら、その綴りをこのルールに足すのが対になる作業である。
