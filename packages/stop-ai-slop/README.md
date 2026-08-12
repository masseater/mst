# @mst/stop-ai-slop

AI が変更へ付け足しやすい、動作上の価値を持たないコードを検出する CLI です。

## 実行

```console
vp exec stop-ai-slop check --base <revision> --head <revision> --repository-root <path>
```

`check` が登録済みの検査機能を定義順にすべて実行します。`--repository-root` の既定値は現在のディレクトリです。`--base` と `--head` は必須で、どちらも Git revision を指定します。

終了コードは次のとおりです。

- `0`: 問題なし。標準出力も空
- `1`: 問題あり。標準出力へ位置と検査 ID を出力
- `2`: 引数、repository、revision、Git、diff、source parse の失敗

## 現在の検査

`no-removal-verification` は、base から head の変更で削除された対象と、同じ変更で新設された不存在検査を完全な locator で関連付けます。

報告するのは次の形です。

- `foo.ts` の削除と `foo.test.ts` の新設
- ファイルの削除と、`node:fs` から import した `existsSync` を `expect(...).toBe(false)` で検査する新しい assertion
- named value export の削除と、同じモジュールの namespace import を `expect(namespace).not.toHaveProperty("name")` または `expect(namespace.name).toBeUndefined()` で検査する新しい assertion

同じ locator の既存 assertion を移動・整形しただけなら、新設された検査として扱いません。import 先の変更で locator が削除対象へ変わった assertion は新設として扱います。rename は削除として扱いません。

## 現在の対象外

名前や文字列だけの一致、コメント、説明文、default export、type export、動的 import、computed property、拡張子を省略した import、path alias、template literal、組み立てた path、別モジュールをまたぐ data flow は報告しません。

検出範囲は、削除対象と追加検査の対応を静的に一意決定できる構文だけに広げます。
