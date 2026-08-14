# 0065. 実行時間の予算はゲート自身に持たせ、CI のジョブから外す

## 状況

main の CI が `The operation was canceled.` で終わった。ジョブが持つ `timeout-minutes: 15` に達した時点で GitHub が打ち切ったもので、失敗した検査は 1 つも無い。

[打ち切られた実行](https://github.com/masseater/mst/actions/runs/31761370192)の記録から読める内訳は、ジョブの開始から 6 分 50 秒でチェックアウト・install・`vp check`・型検査・build・knip・各検査が終わり、そこから 8 分 20 秒テストが走って未完だった。テストの中では `packages/ai-native/src/throttle/run-command.test.ts` が 85.8 秒を占める。process tree の終了を実時間で待つ検査で、15 秒待ちが 4 本ある。

一方で `package.json` の `guard` は `throttle --timeout 1800` を書いている。`--timeout` は包んだコマンドの process tree 全体を打ち切る秒数なので、リポジトリはゲートの予算を 30 分だと既に宣言している。

予算の宣言が 2 つあり、短いほうが先に効いていた。

## 決定

ジョブの `timeout-minutes` を消す。実行時間の予算は `guard` が持つ 1 つだけにする。

予算が 2 つあると、実行が打ち切られたときにどちらが効いたかで報告の形が変わる。ジョブ側が効くと、残るのは GitHub が出す `The operation was canceled.` の 1 行で、何が予算を使い切ったのかは記録から読めない。実際、この実行はテストが全て ✓ のまま打ち切られており、log を最後まで読むまで「検査が落ちた」と区別が付かなかった。

`throttle` が効いた場合は、打ち切った対象と理由が stderr に出て、終了コードが失敗を運ぶ。[EDR 0035](0035-let-exit-codes-carry-the-outcome-and-stderr-carry-the-reason.md) が決めた形に乗る。予算を 1 つに寄せると、時間切れがこの形でしか現れなくなる。

打ち切りの秒数を CI と手元で分けることもしない。手元で 30 分かかるゲートは CI でも 30 分かかってよい。分けると、どちらの数字が本当の予算なのかを読む側が決められなくなる。

## 帰結

- ジョブの上限は GitHub の既定である 6 時間になる。実際に効く上限は `throttle` が持つ 30 分で、変えるときは `package.json` の `guard` を書き換える
- `guard` の外側で止まる経路（チェックアウト、`setup-vp`、install）には上限が無くなる。ここに予算を足すなら、ジョブではなくその経路に足す
- 15 分に収まっていたかどうかは、もはやゲートの合否ではない。所要時間そのものを見たいときは [EDR 0064](0064-carry-one-trace-through-the-gate-and-let-the-agent-query-it.md) が置いた計測を使う
