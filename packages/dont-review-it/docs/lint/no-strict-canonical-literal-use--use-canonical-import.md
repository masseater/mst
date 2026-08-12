# no-strict-canonical-literal-use--use-canonical-import

## 何を検出するか

production source にある literal のうち、値が canonical catalog の語彙に属するものを検出する。

- string、number、boolean、`null` literal
- 置換を持たない template literal
- 単項 `+` / `-` が付いた numeric literal
- literal type の同じnode

同じ値が複数のconceptに属する場合は、1つの報告に全候補を示す。public routeを持たないownerはdeclaration pathで示す。自動修正は持たない。

rule は visitor を返す前に Oxc AST 全体を一度解析し、canonical value candidateとancestorを不変な診断配列へ変換する。`Program` visitorは完成済み診断を報告するだけで、走査順に状態を更新しない。

このruleは一般のJavaScript式を評価しない。文字列連結、標準APIの返値、callback、collection mutation、binding aliasから新しい値を導出する処理は持たない。catalog valueを直接綴ったliteralを使用箇所で禁止し、語彙を新しく定義する構文は [no-local-finite-value-set--use-or-register-canonical-values](./no-local-finite-value-set--use-or-register-canonical-values.md) が受け持つ。

## owner declaration の免除

`@canonical-values` owner declaration内の canonical valuesは概念の定義場所なので報告しない。ただし注釈が存在するだけでは免除しない。

現在のsourceを再走査し、次をcatalog entryと完全一致させる。

- repository rootからのdeclaration path
- concept idとbinding
- annotation start、binding start、declaration start、declaration end

一致したdeclaration range内で、entryのcanonical domainに属するliteralだけを免除する。同じfileのdeclaration外、別path、別binding、古いcache range、不正・duplicate・out-of-scope・値域導出失敗のdeclarationは免除を持たない。

ownerの値域は、最寄りのTypeScript configurationごとに先に作った`typescript-6` Programのcheckerが決める。arrayはnumeric index typeのliteral union、objectはindex signatureを持たないproperty nameを値域にする。checkerが解決できるimportとspreadを扱い、empty・widened・scalar・非literal domain・直接重複はentryを作らない。

## 対象外の構文位置

次のliteralはcanonical valueの使用箇所ではない。

- import、export、dynamic import、import type、import attribute、ambient moduleのmodule specifier
- stringで綴ったimport / export name
- object literal、type literal、class、interface、enumなどの非computed property key
- shadowされていない標準`Pick<T, K>`と`Omit<T, K>`の第2型引数

`Record<"draft" | "published", V>`のkeyは既存構造からの選択ではなく新しい集合の記述なので対象になる。

## production scope と Git ignore

ファイル名に`.fixture.` / `.mock.` / `.test.` / `.spec.` / `.stories.` / `.story.`を含むものと、`__fixtures__` / `__mocks__` / `__stories__` / `__tests__` / `.cache` / `.local-agents` / `coverage` / `dist` / `dist-ssr` / `fixtures` / `test` / `tests` directory配下はproduction sourceではない。

lint開始前に`git ls-files --others --ignored --exclude-standard --directory`からsource scopeを一度だけ作る。Gitが除外する未追跡file、directory、symlink ancestorはrepository sourceに取り込まない。tracked fileは後からignore patternに一致してもrepository sourceのままなので、production scope判定の対象に残す。source scopeとcatalogはlint processの間は不変であり、visitorからGitやrepository scanを再実行しない。

## なぜそれが要るか

ownerが存在してもconsumerが同じ値をliteralで書き直せると、ownerの変更はconsumerへ伝播しない。schemaやtypeだけでなくcomparison、switch、argument、return valueにあるliteralも同じruntime bindingから導出する必要がある。

このruleは使用箇所のliteralを受け持ち、宣言側ruleは有限集合を作る明示構文を受け持つ。二本を同時に有効にすることで、局所の集合と個別の生literalの両方を禁止する。

## どう直すか

報告に示されたownerのregistered public routeからbindingをimportし、そのbindingまたはbindingから導出したtype・schema・membership checkを使う。

報告された値が既存ownerとは別概念なら、その概念を所有するproduction moduleに別ownerを登録する。同じ綴りであることだけを理由に既存conceptへ結び付けない。

## 禁じる回避策

- canonical ruleを`eslint-disable` / `oxlint-disable`で抑制する
- ownerと同じfileの別declarationへliteralを移す
- invalid annotationや同名ambient bindingを置いて免除を作る
- literalをGit ignoredの未追跡fileへ移してrepository sourceとして扱わせる

## オプション

`ownershipPolicy`を文字列で受け取る。所有権の割り当て方針を報告メッセージに載せるだけで、検出範囲は変えない。
