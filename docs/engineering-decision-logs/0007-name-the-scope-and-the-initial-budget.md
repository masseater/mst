# 0007. 検査の範囲と閾値の初期値を名指しで決める

- ステータス: Accepted
- 日付: 2026-08-10

## 文脈

ルール本体は「何行までなら許すか」「どのファイルを production のソースとみなすか」の内容を持たない。上限はルールが既定を持ち、実際の値は利用側の設定が渡す。ファイル種別ごとの違いもルールの内部には置かず、設定を読めば分かる場所に置く。これは `forbid-oversized-file--split-by-responsibility` の文書に規約として書いてある。

その結果、範囲と上限の実際の値は 3 箇所に散る。ルールの既定、mst の oxlint 設定、そして走査とルールが共有する除外リスト。どれも一度書けば全ファイルに効くので、後から「なぜこの値なのか」を辿れる必要がある。

## 決定

**コード行数の初期予算は 400 行にし、mst はルールの既定と同じ値を明示して渡す。** ルールが持つ既定は 400 行（`DEFAULT_MAX_LINES`）で、mst の設定 `packages/dont-review-it/src/configs/oxlint.ts` が同じ `maxLines: 400` を渡す。

数えるのはコード行、つまりトークンが 1 つ以上ある行だけである。空行とコメントだけの行は数えない。この数え方を採ったので、行数を減らす目的で説明を削る動機が消える。

この決定を採った時点の実測では、この予算は最も長いファイル（`no-local-finite-value-set--use-or-register-canonical-values.ts` の 385 コード行）の 15 行上にあった。予算はすでに効いている状態で、次にこのファイルへ手を入れる変更が責務を数え直すことになる。それがこのルールの目的そのものなので、余裕を作るために予算を上げることはしない。

既定と同じ値を設定側にも書くのは、予算が「ルールの都合」ではなく「mst の判断」であることを設定を読む側に示すためである。ルールの既定が動いても mst の予算は動かない。

**走査から外すディレクトリは固定リストで名指しする。** `packages/dont-review-it/src/lint/oxlint/lib/canonical-values/source-files.ts` の `UNSCANNED_DIRECTORY_NAMES` は `.cache` / `.git` / `.local-agents` / `coverage` / `dist` / `dist-ssr` / `node_modules` の 7 つ。ドット始まりの名前を一括で外してはいない。`.cache` と `.git` と `.local-agents` を個別に挙げていることがその証拠で、一括除外を併用していればこの 3 つは冗長になる。

**production 対象外 source の分類を 1 つにし、lint の除外と strict verification の problem を分ける。** `packages/dont-review-it/src/lint/oxlint/lib/out-of-scope-source.ts` が次の綴りを 1 箇所で定義する。

- ファイル名の `.fixture.` `.mock.` `.test.` `.spec.` `.stories.` `.story.`
- directory 名の `__fixtures__` `__mocks__` `__stories__` `__tests__` `.cache` `.local-agents` `coverage` `dist` `dist-ssr` `fixtures` `test` `tests`

`source-files.ts` の `declarationSources` は、この分類に当たらない `.ts` / `.tsx` / `.mts` / `.cts` だけを owner 候補にする。`.d.ts` / `.d.mts` / `.d.cts` も runtime initializer を持たないため owner 候補から外す。2 本の canonical-values lint rule は同じ分類に当たるファイルでは visitor を返さず、production の lint report を test や Story に出さない。

production から対象外 source へ向かう境界は、Git が repository source として可視にしている path だけを対象にする。判定には `git check-ignore` を使い、repository ごとの `.gitignore`、nested ignore、exclude 設定に従う。除外された未追跡の生成物・cache・agent artifact は境界候補へ入れない。追跡済み file は後から ignore pattern に一致しても Git の source であり、production 対象外の分類に当たるなら境界として報告する。

一方、repository scan の `commentSources` は JavaScript を含む全 script source を持ち、production 対象外 file も読む。`@canonical-values` が見つかれば同じ Oxc scanner で解釈し、正規 declaration の形なら `out-of-scope-declaration`、形自体が不正なら対応する `invalid-declaration` を strict analysis の problem にする。対象外 source は lint されないことを owner 登録の迂回には使えず、catalog entry と免除 range を一切持たない。

mst の規約はテストを対象と同階層の `.test.ts` に固定していて、`.spec.` も、ここに並ぶ directory 名も存在しない。これらは rule を取り込む repository の一般的な test・fixture・Story の綴りを production owner から外すために持つ。

## 影響

決定時の予算は当時の最大より 15 行しか上になかった。その後、canonical-values の解析は責務別 module へ分割され、現在の no-local 本体は 137 物理行、同階層の test は 365 物理行である。400 コード行の予算は変えず、当たったときの行き先は分割かシナリオの削減であって、予算の引き上げではない。

ファイル種別ごとに別の予算を置く仕組み（設定側の `overrides` で同じルールを別の値で宣言する）はルールの文書にあるが、mst では使っていない。この決定を採った時点では実装ファイルとテストファイルの最大がそれぞれ 385 行と 382 行で、種別で分ける根拠が数字の側に出ていなかったためである。

走査対象は、ドット始まりのディレクトリを名前だけでは落とさない。新しくドット始まりのディレクトリに `.ts` 系のファイルか `package.json` が置かれると、リストに足さない限り走査される。ビルド出力のディレクトリが増えたときも同じで、リストの編集が要る。

canonical owner の対象判定と 2 本の lint rule の対象判定は、同じ `isOutOfScopeSource` を使う。ファイル分類は `.fixture.` / `.mock.` / `.test.` / `.spec.` / `.stories.` / `.story.` という区切りを要求するので、`contest.ts` のように `test.ts` で終わるだけの名前は拾わない。`no-detached-test-file--move-beside-source` が既定で見る `.test.ts` / `.test.tsx` / `.spec.ts` / `.spec.tsx` とも test・spec の綴りが揃う。

`.spec.` を書いた時点で、canonical-values の 2 本の lint rule の対象から外れ、かつ同名の source が隣に無ければ配置違反として報告される。さらに `@canonical-values` を書けば strict verification が production 対象外の owner 候補として拒否する。`.spec.` を使わないという規約と、対象外 file を owner にできない契約は、別の検査経路で守られる。

## 検討して採らなかった案

**物理行をそのまま数える。** 空行とコメント行が予算を食うので、予算に近づいたファイルで最初に起きるのは説明を削ることになる。責務を数え直させたいのに、説明を削る動機を与える数え方になっていた。

**予算を 500 行に置く。** 現在の最大より 115 行の余裕ができる。当面どのファイルも当たらないので、予算があること自体が忘れられる。予算は当たって初めて仕事をする。

## 記録が残っていない選択

除外の 2 つについては、そう決めた理由が実装にもコミットログにも残っていない。ここに書いておくのは、後から読む人が「理由があるはず」と仮定しないためである。

**ドット始まり一括ではなく列挙を選んだ理由。** `source-files.ts` は eefb305 で丸ごと入っており、一括除外から列挙へ変えた履歴も git に無い。読み取れるのは、列挙になっているという事実と、`.cache` / `.git` を個別に挙げているという事実だけである。

**区分ではなく綴りの水準まで `.spec.` を広げた理由。** 記録があるのは区分の水準までで、「テストの source、fixture の directory、Story は production の source ではない」という区分はルールの文書に書かれている。その区分を、mst に存在しない `.spec.` `.stories.` `.story.` や `__tests__` などの綴りにまで広げた理由は残っていない。

読み取れるのは、これらの綴りが mst の規約ではなく、ルールを配る側が想定する取り込み先の規約だということだけである。`.spec.` を検出側にも入れたのは、除外側に既にあったものに揃えた結果であり、mst の規約が変わったからではない。

どちらも、触る必要が出たときに決め直してよい。決め直したらこの節を消して、決定の側に書く。
