# no-single-use-local-type--inline-at-the-use-site

## 何を検出するか

production の TypeScript ソースで、そのファイルがトップレベルに宣言し、export していない型エイリアスが、同じファイルの中から 1 回以下しか参照されていない状態。

宣言として見るのは型エイリアスだけで、ファイルのトップレベルに立っているものだけを対象にする。関数やブロックの内側に置かれた型宣言は対象にしない。

interface は同時に報告しない。配布 config の `typescript/consistent-type-definitions` が interface を type alias へ自動修正し、その後も参照が 1 回以下なら、この rule が type alias を報告する。通常の型位置、唯一の `implements`、唯一の interface heritage、自己参照のどれに使われる interface でも、この順序で診断の authority を 1 本ずつにする。

宣言から scope が解決した Variable を取得し、その Variable に解決された参照だけを数える。識別子の文字列が同じだけでは同じ型として扱わない。関数内の型引数や nested interface がトップレベルの型と同名でも、それぞれ別の Variable なので参照は混ざらない。

参照として数えるのは次の 3 つ。

- 型参照（`readonly draft: Draft` の `Draft`）
- インターフェースの `extends` 節
- クラスの `implements` 節

`typeof X` は値の `X` を指していて型宣言の `X` を指していないので、数に入れない。宣言そのものが名乗る名前も数に入れない。

### 自分自身への参照

型が自分の本体の中で自分を参照している場合、その参照は数に入る。したがって再帰する型は、他所から 1 回参照されていれば合計 2 回になり、報告されない。再帰する型は展開できないので、これは意図した結果である。

再帰する型が他所から 1 回も参照されていなければ、自己参照だけの 1 回になって報告される。このときの直し方は展開ではなく削除で、それは実行できる。

### export された型を見ない理由

このルールが数えるのはファイル 1 つの中だけである。export された型の参照を数えるにはリポジトリ全体で import を解決する必要があり、名前だけを頼りに数えると別のファイルの同名の型と混ざる。実際にこのリポジトリには `ParsedSource` という同じ名前の型が別の構造で 2 箇所にある。

決定的に判定できる範囲に限る、という [EDR 0013](../../../../docs/engineering-decision-logs/0013-draw-the-duplication-line-at-decidability.md) の線をここでも引いている。1 ファイルの中に閉じた参照は構文だけで数え切れる。

そのため、宣言自体を export した型と、後続の `export type { Draft }` や `export type { Draft as PublishedDraft }` で公開した型は対象から外れる。export specifier も同じ resolved Variable を参照していることを確認して判定する。これは検出の穴であって、直し方ではない。「禁じる回避策」に挙げてある。

## なぜそれが要るか

型に名前を付ける理由は、2 箇所以上がその形について合意する必要があるからである。合意する相手がいない名前は、合意を作らずに間接参照だけを作る。形を知りたい読み手は、いま読んでいる行を離れて宣言まで移動し、戻ってこなければならない。

名前はさらに、そこに共有があるという誤った合図を出す。「この型は他でも使われているはずだ」と読んだ人は、変更するときに影響範囲を探しに行く。探しても何も出てこない。

[EDR 0013](../../../../docs/engineering-decision-logs/0013-draw-the-duplication-line-at-decidability.md) は「一度しか使われないヘルパー」を、判定は決定的にできるが規範として成立しないとして lint から外した。そこで数えたのは値の宣言で、長い手続きを名前付きの段に割る書き方が大半を占めていた。型は違う。型エイリアスは実行時に何も起こさず、段に割る対象になる手続きを持たない。単一使用の型別名に残るのは間接参照だけである。この違いで判断を分けた記録が [EDR 0019](../../../../docs/engineering-decision-logs/0019-name-a-type-only-where-two-places-agree.md) にある。

自動修正を持たないのは、報告された宣言に対して直し方が 1 つに決まらないから。使用箇所に展開するのが普通だが、参照が 0 回なら削除であり、本当は共有されるべき形なら 2 つ目の使用箇所を作るのが正しい。どれを選ぶかは周囲を読んだ人が決める。

## どう直すか

型エイリアスが通常の型位置から 1 回だけ参照されているなら、参照をエイリアスの右辺で置き換え、宣言を消す。型引数を持つ宣言なら、使用箇所で型引数を実引数に置き換えてから書く。

型エイリアスの右辺が free type name を参照している場合、使用箇所へ移したあとも同じ binding を指すようにする。使用箇所を囲む type parameter や nested type declaration が同名なら、先にその shadowing binding を alpha-rename してから展開する。名前の文字列をそのままコピーすると、展開前は外側の import や宣言を指していた type reference が、展開後には使用箇所の type parameter を指すように変わる。

参照が 0 回なら宣言ごと消す。自己参照しかない recursive type も consumer が存在しないので、展開せず宣言全体を消す。

参照が interface の `extends` 節 1 箇所だけなら、type alias の右辺が表す object types で `extends Base` を置き換え、型引数を置換してから type alias を消す。この移動でも、extending interface の type parameter が type alias の free type name を shadow するなら先に alpha-rename する。

参照が class の `implements` 節 1 箇所だけなら、`implements TypeName` と型エイリアスを削除する。class は structural contract を満たす concrete members を既に持っている。

その形が本当に 2 箇所で共有されるべきものなら、足りないのは 2 つ目の使用箇所である。同じ形を別に綴っている場所を探し、そこにこの型を使わせる。宣言を残す理由になるのは、実際に 2 箇所目が参照することだけで、将来そうなる見込みではない。

### knip の未使用 export 指摘に従った直後は、この報告が出る

knip が「どこからも import されていない export」を挙げ、それに従って `export` を落とすと、その型は非 export のトップレベル型になる。自ファイル内の参照が 1 回だけなら、その時点でこのルールの対象に入る。`knip.json` に `includeEntryExports: true` が入っているので、barrel から外す作業のたびにこの並びが起きる。

これは 2 本の指摘が食い違っているのではなく、続きになっている。knip が「外から要らない」と言い、このルールが「中でも 1 回しか要らない」と言う。順に従えば、export を落として使用箇所に展開するところまでで 1 つの作業になる。実際に、公開する export を絞る作業で非 export になった 3 件がこの順で片付いた。

## 禁じる回避策

- export を付けて報告から外す。形はどこにも動いておらず、export された型を他のファイルが 1 つも import しない状態が残る
- 型を 2 回参照するだけの使い捨ての宣言を足す。参照の数は増えるが、合意する場所は増えていない
- 型を別ファイルに移して import する。1 箇所からしか参照されない形が、ファイルを 1 つ増やしただけの状態になる
- ルールごとの除外、ファイルごとの除外、宣言ごとの除外タグ。どれも用意しない

## 何を検出しないか

- export された型。前述のとおり、1 ファイルに閉じた判定でないと決定的に数えられない
- interface。配布 config の `typescript/consistent-type-definitions` が先に type alias へ修正し、修正後の source をこの rule が検査する
- declaration file の型。ambient declaration は別ファイルから参照・merge されるため、1 ファイル内の参照数では local type と判定できない
- 関数やブロックの内側で宣言された型。トップレベルに立っていないものは、その場の手続きの一部である
- 値の宣言。定数もヘルパー関数も、1 回しか使われていないことを理由には報告しない。[EDR 0013](../../../../docs/engineering-decision-logs/0013-draw-the-duplication-line-at-decidability.md) で数えて外した判断をそのまま引き継ぐ
- 2 回以上参照されている型。参照が型の位置に現れる限り、それが同じ関数の中にまとまっていても報告しない

## 導入時に直した数

非 export のトップレベル型宣言 34 件のうち 16 件（47%）が 1 回以下の参照だった。0 回のものは無かった。

export されたトップレベル型宣言 37 件のうち 5 件は、リポジトリ内のどのファイルからも import されていなかった。うち 1 件は 2 本のルールが共有する場所へ移し、3 件は export を外してから使用箇所に展開し、1 件はどこからも参照されていなかったので宣言ごと消した。

この計測のあと、公開する export を絞る作業が別に入り、非 export になった型が 3 件増えた（`WorkspaceLintRuleMeta` / `LintRuleSeverity` / `LintRuleTestCases`）。いずれも自ファイル内の参照が 1 回で、同じように展開した。export を外す作業とこのルールが噛み合うことが、そこで確かめられている。
