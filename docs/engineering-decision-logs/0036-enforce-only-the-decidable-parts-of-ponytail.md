# 0036. Ponytail のうち違反状態を決定できる部分だけを強制する

- ステータス: Accepted
- 日付: 2026-08-11

## 文脈

[Ponytail](https://github.com/DietrichGebert/ponytail) は、不要な実装を作らず、既存コード、標準ライブラリ、platform、導入済み依存の順に再利用し、それでも必要な最小のコードだけを書くための agent 向け skill 群である。repo 全体を対象にする audit は、dead code、標準機能の再実装、単一実装 interface、単一 product factory、単純委譲 wrapper、単一 export file、固定された flag/config を検査対象として挙げている。

この指針には、機械で判定できる構文上の状態と、要求・将来・責務の読み取りを要する判断が混ざっている。「本当に必要か」「最小か」「ファイルが多すぎるか」は同じ構文でも状況により答えが変わる。一方、呼び先と引数を変えずに中継する local function や、全 callsite が同じ既定値しか使わない local parameter は、scope と call graph を閉じられる範囲なら違反状態を決定できる。

[強制の機構](../guidelines/enforcement.md) は、機械で一意に判定できる違反にガードを置き、破られた不変条件と修正の方向を報告することを求める。[0034](0034-separate-the-violation-from-the-choice-of-repair.md) は、修正案が複数あることを理由に違反を成功へ読み替えない。

## 決定

**Ponytail の文を lint の規範として直接取り込まない。** 各主張を、不変条件、判定に必要な材料、既存の強制、報告できる修正方向へ分解する。リポジトリ内の構文・binding・静的 callsite だけで違反状態を決定できる項目だけを error にする。

**既製の rule が同じ不変条件を持つ項目は既製の rule に任せる。** core 3 件、TypeScript 1 件、Unicorn 22 件の計 26 件を追加する。対象は、不要な call/return、`Object.hasOwn`、readonly property、collection argument、flatMap、Blob、classList、code point、Date、DOM、import.meta、Math、negative index、number coercion、optional catch binding、query selector、regexp test、Response JSON、`String.raw`、`replaceAll`、`structuredClone` への置換である。

既製 rule 同士、または既存の自作 rule と同じ箇所を二重に報告する候補は採らない。異なる修正先を同時に要求する候補、安全でない自動修正を持つ候補、同じ式を同じ rule が二重報告する候補も採らない。追加した rule は実際の違反入力で発火を確認し、同じ違反の権威を 1 本にする。

**local な単純委譲と単一 product factory を `no-identity-wrapper--use-the-target-directly` が検出する。** 呼出しまたは構築を target へそのまま転送し、参照が 1 件以上の閉じた direct call/new 集合で、runtime parameter と引数が一致する local function に限る。export、callback、値としての escape、overload、async/generator、実行 context に依存する target は対象にしない。binding の shadow と評価順を保ったうえで callsite に target を置き、wrapper を削除する方向を報告する。

**local な単一実装 contract を `no-single-use-local-type--inline-at-the-use-site` が検出する。** 非 export のトップレベル type alias の resolved binding が 1 箇所以下からしか型として参照されない場合に限る。唯一の `implements`、唯一の interface heritage、通常の型参照、自己参照、未使用を分けて修正方向を報告する。interface は既製の `typescript/consistent-type-definitions` だけが最初に報告し、その自動修正で type alias になった後に自作 rule が単一使用を報告する。export、declaration file、2 箇所以上が合意する型は対象にしない。

**実質固定された local option を `no-invariant-default-parameter--remove-unused-option` が検出する。** 外へ escape しない function の全 callsite を数え、既定値を含む effective argument が同じ静的値だけになる parameter に限る。残る parameter initializer と本体にある対象 binding の resolved reference を値へ置換し、parameter と全 actual argument を削除する方向を報告する。先行する parameter initializer が後続の対象 binding を読む形は TDZ の失敗を保存できないため報告しない。外部 callsite、動的な値、実行 context の観測、overload contract が残る function も対象にしない。

**標準機能の手書き再実装は、個別の置換を知る既製 rule だけで扱う。** 任意の loop や helper を「もっと短く書ける」と推測する汎用 rule は置かない。既存の `no-array-mutation`、`no-reassign`、重複本体、未使用 export/dependency の検査も、具体的な不変条件を既に持つ範囲で Ponytail と同じ方向を守る。

**次の主張は lint にしない。**

- speculative な要求、将来の拡張、機能そのものが要るかという YAGNI の判断
- 任意の layer に caller が 1 つしかないこと、file が 1 つだけ export すること、ファイル数が最小であること
- arbitrary な実装が「最短」「boring」「clever」であるかという評価
- native platform と dependency のどちらが product 要件を満たすかという選択
- Ponytail の応答形式、強度、agent の persistence
- `ponytail:` comment による debt ledger。このリポジトリは説明 comment を禁止し、判断の根拠を commit と EDR に置く
- Ponytail が提案する最小 1 件の smoke test。このリポジトリの test 配置と coverage 100% の規範を弱めない

## 影響

- agent skill の適用に依存せず、安定した構文上の違反は `vp check` で同じように失敗する
- 自作 rule は誤報を避けるため local binding と閉じた call/reference 集合に限られ、cross-file の同種構造は検出しない
- 単一使用の interface は既製 rule と自作 rule が同時報告せず、interface から type alias への修正後に単一使用の診断へ進む
- 修正案が複数ある違反は自動修正せず、binding、評価順、型 contract を保つ修正方向を報告する
- 一般的な over-engineering review は残るが、機械化した同じ判定を人が重ねて確認する必要はない

## 検討して採らなかった案

**audit の hunt list を件数だけで機械化する。** interface の実装数、caller 数、export 数は数えられるが、数が 1 であること自体は違反を意味しない。責務分離、公開 API、型 contract を壊す誤報になるため採らない。

**短い実装へ変換できそうな構文を自作 rule で広く探す。** 標準 API の semantics と edge case を rule 側が再実装し、公式 rule と権威が重なる。既製 rule が具体的な置換を知る範囲だけを採る。

**cross-file symbol graph ですべての単一使用を数える。** export された API、dynamic import、外部 consumer を閉じられない。全参照を確定できる private/local binding から始め、検出範囲を広く見せるための推測は加えない。
