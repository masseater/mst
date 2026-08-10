# no-twin-declaration--merge-into-one-owner

## 何を検出するか

production の TypeScript ソースで、名前も本体もリポジトリ内の別の宣言と一致する宣言。

対象はトップレベルの宣言で、次の 4 つの形。

- 束縛（`const` / `let` / `var`）
- 関数宣言
- 型エイリアス
- インターフェース

一致の判定に使う本体の作り方と、その正規化は [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md) と同じものを使う。同じ索引を 2 本のルールが別々の引き方で見ている。

### 本体の大きさに下限を置かない理由

`no-duplicated-body` は本体が AST ノード 8 個に満たない宣言を報告しない。短い本体は偶然に一致するからで、`= 1` や `= []` が 2 箇所で一致しても共有すべき振る舞いは無い。

このルールは下限を持たない。名前まで一致していることが、偶然の一致を排する根拠になる。`= "package.json"` が 2 箇所にあるだけなら偶然だが、`MANIFEST_FILE_NAME = "package.json"` が 2 箇所にあれば、同じ概念を 2 回書いたということである。

実際にこのリポジトリで見つかった 3 組は、いずれも本体が AST ノード 1 個の単一のスカラーだった。`no-duplicated-body` の下限はこれを設計どおり素通りさせていた。

### 2 本のルールが同じ箇所を報告することがある

名前も本体も一致し、かつ本体が 8 ノード以上なら、`no-duplicated-body` もこの宣言を報告する。どちらの報告も同時に正しく、所有者を 1 つに決めれば両方消える。片方を抑える細工は入れていない。導入時点でこれに当たる組は無かった。

### 索引の範囲

索引はリポジトリ根から作る。根は lint の実行ディレクトリから上に辿って決める。テストファイルとテスト用ディレクトリの配下は索引に入らない。判定は [no-strict-canonical-literal-use--use-canonical-import](./no-strict-canonical-literal-use--use-canonical-import.md) と同じものを使う。

## なぜそれが要るか

同じ名前の宣言が 2 箇所にあると、片方だけ変えても何も落ちない。型検査も通り、テストも通る。名前が同じである以上、読み手はどちらか一方を見て「これがその概念の定義だ」と判断する。もう一方が古い値を持ったまま別の呼び出し元に届いていることは、実行時に食い違うまで表面化しない。

本体だけが一致する重複と違って、ここには「同じ概念か」を人が判断する余地がほとんど無い。名前は書き手が概念に付けた札で、それが一致しているということは、2 つの場所が同じ概念を指していると書き手自身が言っているに等しい。

自動修正を持たないのは、どちらが所有者かを機械が決められないから。所有者の選択は責務の配置の問題で、綴りからは導けない。

## どう直すか

報告に並んだ位置を全部読んでから、どこがその概念を所有すべきかを決める。決めたら、そこから export して他の全箇所は import する。

所有者を選ぶときは、報告に並んだ順序で選ばない。先に書かれた方を選ばない。ファイルが短い方を選ばない。その概念が誰の責務かで選ぶ。

どちらのファイルの責務でもないなら、その概念を所有する場所を新しく作る。導入時に見つかった 3 組はいずれもこれに当たり、AST のノード種別を表す定数と、パッケージマニフェストについての定数を、それぞれ新しい所有者に移した。

名前が同じでも本当に別の概念だと判断したなら、片方の名前を変える。ただしそのときは、名前が同じだっただけでなく本体も同じだったという事実が残る。本体が 8 ノード以上あれば `no-duplicated-body` が引き続き報告するので、そこでも所有者を決めることになる。

## 禁じる回避策

- 片方の名前を変えて報告から外す。同じ本体が 2 箇所にある状態は変わらない
- 本体に意味の無い記述を足して一致から外す。同上
- 片方をテストファイルに移す。索引がテストを見ないことを、重複を隠す口として使わない
- ルールごとの除外、パッケージごとの除外、宣言ごとの除外タグ。どれも用意しない

## 何を検出しないか

- 名前が違って本体だけが一致する宣言。それは [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md) が本体の大きさを条件に扱う
- 名前が一致して本体が違う宣言。1 つの名前が 2 つの意味を持っている状態で、直し方は統合ではなく改名になる。判定は決定的にできるが、このルールの指示（統合しろ）と噛み合わないので入れていない。導入時点でこのリポジトリには 1 組（`ParsedSource`）ある
- 完全一致に満たない類似。[EDR 0013](../../../../docs/engineering-decision-logs/0013-draw-the-duplication-line-at-decidability.md) で採らないことにした
- トップレベルに立っていない宣言。他の宣言の内側にあるものは、その場の手続きの一部である

## 導入時に直した数

名前も本体も一致する組は 3 つで、6 箇所を直した。いずれも本体は AST ノード 1 個の単一のスカラーである。

- `NODE_TYPE_FIELD = "type"`（`canonical-values/declarations.ts` と `duplicated-bodies/declarations.ts`）
- `EXPORTS_CONDITION_DEPTH_LIMIT = 8`（`canonical-values/export-specifier-index.ts` と `library-vocabulary/dependency-types.ts`）
- `MANIFEST_FILE_NAME = "package.json"`（`canonical-values/source-files.ts` と `canonical-values/workspace-root.ts`）

型宣言のうち、名前も本体も一致するものは 0 件だった。本体だけが一致するものは 1 組あり、これは索引に型宣言が入ったことで [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md) が新しく報告した。`{ readonly messageId: string; readonly data: Readonly<Record<string, string>> }` を `Misplacement` と `OwnerReport` の 2 つの名前で宣言していたもので、`lib/rule-message.ts` の `RuleMessage` に寄せた。
