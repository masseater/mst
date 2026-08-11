# @mst/dont-review-it

生成物。`vp run guard:fix` が `specs/` の仕様担保テストから再生成する。手で編集しない。

## リポジトリ検査の入口

- check 以外の命令を名指しで拒否する
- 存在しない場所を検査対象に取らない
