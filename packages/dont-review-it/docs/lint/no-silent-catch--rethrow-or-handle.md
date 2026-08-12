# no-silent-catch--rethrow-or-handle

## 何を検出するか

束縛を持ち、本体に文が 1 つ以上ある `catch` 節のうち、捕まえた失敗が節の外へ一度も出ていないもの。

### 何をもって「記録した」とみなすか

束縛への読み取りの参照を 1 つ取り、そこから外側へ辿って `catch` 節に届くまでの経路を見る。その経路が条件の位置を通らずに `catch` 節へ届いたなら、その参照は失敗をどこかへ運んでいる。運んでいる参照が 1 つでもあれば、その `catch` 節は失敗を記録している。

運んでいると数える形は次のとおり。綴りは違うが、判定はどれも同じ 1 つの問いで済んでいる。

- 再送出する（`throw failure`）
- この層を名指しした失敗に元の失敗を入れて投げる（`throw new Error("reading the catalog failed", { cause: failure })`）
- 呼び出しへ渡す（`report(failure)`、`console.error(failure)`）
- 返す値に入れる（`return { unreadable: path, cause: failure }`）
- 宣言した値に入れる（`const unreadable = { at: "catalog", cause: failure };`）
- 節の中で作った関数へ渡す（`register(() => report(failure))`）

運んでいると数えない形は次のとおり。

- 条件の位置でだけ読む。`if` / `while` / `do while` / `for` の条件、三項の条件、`switch` の判定式がここに入る。条件は失敗を見て経路を選ぶだけで、失敗そのものは節の中に留まる
- 書き込みだけの参照（`failure = null`）。束縛が指していた失敗はそこで消える

束縛の解決はスコープで行う。節の中で同じ綴りの別の束縛を作っても、その参照は捕まえた失敗の参照として数えない。

このリポジトリの `packages/agentic-documents/src/scan/read-file.ts` にある形が、参照 2 つの内訳をそのまま示している。

```ts
export const statOrNull = async (absolutePath: string): Promise<Stats | null> => {
  try {
    return await lstat(absolutePath);
  } catch (failure) {
    if (isAbsent(failure)) return null;
    throw failure;
  }
};
```

この節は束縛を 2 回読んでいる。`isAbsent(failure)` は条件の位置なので数えず、`throw failure` が数えられる。条件の位置の読み取りしか無ければ、この節は報告される。

### 走査の境界

参照から外側へ辿る経路は、最初に見つかった `catch` 節で終わる。節の中で作った関数の中にある参照も、関数の境界を跨いで辿る。失敗を渡された関数がいつ走るかは分からないが、渡した時点で失敗は節の外の何かに届いている。

入れ子の `try` があるときは、内側の `catch` 節が内側の束縛を持つ。外側が再送出していても、内側は内側の参照だけで判定する。

条件の中に置いた再送出（`if (isFatal(failure)) throw failure;`）は、その `throw` の参照が数えられるので通る。条件が偽の経路に何も残らないことは、このルールでは見ていない。

### 他のルールとの境界

失敗を握り潰す形は、見ているものが違う 5 本で分担している。

| 形                                        | 見ているもの                                       |
| ----------------------------------------- | -------------------------------------------------- |
| `catch (failure) { }`（本体が空）         | `no-empty-catch--throw-or-handle` と `no-empty`    |
| `catch { ... }`（束縛が無い）             | `no-discarded-failure--receive-and-surface-it`     |
| `catch (failure) { throw failure; }` だけ | `no-useless-catch`                                 |
| 失敗を出力先へ書いてから続行する          | `no-logged-and-continued-failure--stop-or-recover` |
| 束縛も本体もあるが、失敗が節の外へ出ない  | 本ルール                                           |

本体に文が 1 つも無い `catch` は本ルールの対象にしない。空の本体は `no-empty-catch--throw-or-handle` が見ており、そこに何を書くかの指示もそちらが持つ。同じ `catch` に 2 本のルールが同じ修正を求める状態を作らないための境界である。本ルールが見るのは、文が入っているのに失敗が外へ出ていない節だけである。

束縛を持たない `catch` も対象にしない。運ぶべき名前が無いところで「運べ」と言っても、直し方が一意に決まらない。束縛を付けろと言うのは `no-discarded-failure--receive-and-surface-it` の報告で、付けた後に失敗が外へ出ていなければ本ルールが報告する。

同じ節に 2 件出る組み合わせが 2 つある。どちらも見ているものが違い、片方だけを直しても残る。

- 下線だけで綴った束縛（`catch (_) { retry(); }`）。`no-discarded-failure--receive-and-surface-it` は束縛の綴りを見て「読むつもりが無い」と報告し、本ルールは失敗の行き先を見て報告する
- 失敗を含まない文字列を書いて続行する（`catch (failure) { console.error("failed"); }`）。`no-logged-and-continued-failure--stop-or-recover` は書き込みと続行の同居を見て「止めるか戻せ」と言い、本ルールは失敗が外へ出ていないことを見て「失敗を運べ」と言う

ファイル種別による例外は持たない。テストコードも同じに扱う。

## なぜそれが要るか

守っている不変条件は「捕まえた失敗の跡が、それを捕まえた `catch` 節の外に残る」ことである。

`catch` 節は、失敗を消す場所ではなく、失敗の行き先を決める場所である。行き先は 2 種類しかない。呼び出し側へ返すか、失敗を受け取って動く何かへ渡すか、である。どちらも選ばなかった節は、失敗を握ったまま終わり、束縛が消えるのと同時に失敗も消える。

壊れ方は 2 層ある。

1 層目は、失敗した実行と成功した実行が、外から同じに見えることである。`try` の中の操作は最後まで進まなかったのに、`catch` 節を抜けた後の処理は成功したときと同じ経路を進む。呼び出し側が受け取る値も、プロセスの終了コードも、失敗しなかったときと変わらない。呼び出し側には、区別するための材料が 1 つも渡っていない。

2 層目は、材料が無いことが検査に現れないことである。テストは書かれたとおりに通り、型検査も通り、CI も緑になる。このリポジトリが最も嫌う「lint が緑なのに検査されていない」は、値の不足ではなく材料の不足から生まれる。何が失敗したかを誰も持っていない状態は、後から復元できない。

本体が空でないことが、この状態を見えにくくする。空の `catch` は読み手に怪しさが伝わるが、文が 1 つ入った途端に「何かしている」と読まれる。`retry();` だけを持つ節は、やり直しを 1 回試したことしか表しておらず、そのやり直しも失敗したときに何が起きたかは残らない。条件で振り分けている節も同じで、`if (isTransient(failure))` は失敗を見てはいるが、見た結果はその場の分岐に使われて消える。

## どう直すか

その `catch` 節で捕まえた失敗の行き先を 1 つ決める。「記録した」と数えるのは、失敗が節の外へ出る形だけである。

**呼び出し側へ返す。** そのまま再送出するか、この層の関与を名前にした失敗に元の失敗を入れて投げる。

```ts
try {
  return await lstat(absolutePath);
} catch (failure) {
  throw new Error(`reading ${absolutePath} failed`, { cause: failure });
}
```

`cause` に入れれば、元の失敗は失われない。文字列に潰して渡すのではなく、失敗そのものを入れること。

**失敗を受け取って動く何かへ渡す。** 渡す先は、失敗を持って次の判断ができるものに限る。

**不在だけを値にして、それ以外は返す。** 条件で振り分けるなら、振り分けた先のそれぞれで行き先を決める。`packages/agentic-documents/src/scan/read-file.ts` がこの形である。

```ts
export const directoryNamesIn = async (absolutePath: string): Promise<readonly string[]> => {
  try {
    const entries = await readdir(absolutePath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (failure) {
    if (isAbsent(failure)) return [];
    throw failure;
  }
};
```

`ENOENT` と `ENOTDIR` は「そこに無い」であり、正常な入力なので値にしてよい。それ以外は「あるが読めない」であり、正常な入力ではないので再送出する。条件を書いた時点で失敗を扱ったことにはならず、条件の後の各経路に行き先が要る。

**戻り値の型を変えたくない、という理由で値に潰したくなったら、それは返す側を選ぶべき状況である。** 失敗を区別できない値を返すことは、失敗を消すことと同じである。

## 禁じる回避策

- 束縛を 1 度書くだけの文を置く（`failure;` / `void failure;`）。参照は数えられて報告は消えるが、失敗はその文の外へ出ていない
- 束縛を値に受けて、その値を誰も読まない（`const noted = failure;` で終わる）。同上
- 何もしない呼び出しへ渡す（`ignore(failure)`）。同上
- 条件の中でだけ再送出して、条件が偽の経路には何も残さない（`if (isFatal(failure)) throw failure;`）。判定は参照の位置を見ているので報告は消える。偽の経路で失敗が消えることは変わらない
- 条件を変数へ取り出してから分岐する（`const missing = codeOf(failure) === "ENOENT";` を書いてから `if (missing)`）。宣言の位置に現れた参照は運んだものとして数えられるので報告は消える。失敗が節の外へ出ていないことは変わらない
- 束縛を消して `catch { ... }` にする。本ルールは黙るが `no-discarded-failure--receive-and-surface-it` が報告する
- 本体を空にして黙らせる。本ルールは黙るが `no-empty-catch--throw-or-handle` と `no-empty` が報告する
- 失敗を文字列に潰してから渡し、元の失敗を捨てる（`report(String(failure))`）。判定は参照が外へ出たかを見ているので通る。`cause` に入れて渡せば、潰さずに同じことができる
- `try` / `catch` の範囲を広げて、失敗が起きうる操作を 1 つの節でまとめて黙らせる。節の数は減るが、どの操作が失敗したのかが分からなくなる
- 抑制ディレクティブ

## オプション

取らない。有効か無効かだけを設定側で決める。

このルールが持つ判断は「失敗が節の外へ出たか」だけで、その答えは参照の位置から決まる。閾値も、対象ごとに変わる語彙も、例外の一覧も持たない。条件の位置を記録として数える設定を開ければ、それは失敗を消す経路を設定で作れるということなので、開けない。
