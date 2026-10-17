# 《诱饵·挑战版》

同一规则（`DROP` 标记）的第二个结构，比入门版长得多。**规则说明见 [`../decoy-20261018/README.md`](../decoy-20261018/README.md)。** 这不是地图集作品，依赖本体不存在的 `DROP` 动作，只在 `experiment/one-shot-passage` 分支上存在。

## 谜题

- 28 格活动区（x=0..6、y=0..3）
- 起点 (0,1)，终点 (6,0)
- 终点由 A 门守住（(6,0)-(6,1)），初始关闭
- 按钮 A 在 (2,0)，朝上
- 鬼在 (2,2)

```
y=0: .  .  [A] .  .  .  E      (A 门在 (6,0)-(6,1) 之间)
y=1: P  .  .  .  .  .  #
y=2: .  .  G  .  .  .  .
y=3: .  .  .  .  .  .  .
```

## 验证结果

| 项目 | 结果 |
| --- | --- |
| 本体规则 | **穷尽无解** |
| 诱饵规则 | **28 步，2 条最优解** |
| 两条最优都含 **4 次** DROP | 是（2/2） |
| 冷初态 | 通过 |
| 去终点安全 | 通过 |
| 分享码 | `AADB_f39_AAAAAEx4BBABAKqoBAAAqqgAAAABA5ICQEgIAAAAAAA` |
| mapId | `00bfb7cc775d0ec2f2a7f2af6d3f9ea22fcd2cf45881dcb305a5407f853d55b0` |

参考解：

```
UDROPDROPDDDRRRRUURDROPDDDROPLLLUUUURRRR
UDROPDROPDDDRRRRRUUDROPDDDROPLLLUUUURRRR
```

节奏是“放标记 → 前进 → 再放标记 → 折返 → 按按钮 → 再放标记”，需要**四次标记、两次折返**。两条最优解同样长、同样需要四次标记，不存在“少放一次也能过”的捷径。

## 为什么它值得作为挑战版

- 入门版 10 步、2 次标记，用来让人理解规则；
- 挑战版 28 步、4 次标记、两次折返，要求玩家把“标记当作一段可规划的时间”而不是一次性技巧；
- 两版都是“本体无解”，差异不是难度微调，而是**新规则带来的新解法**。

## 复验

```bash
node examples/decoy-challenge-20261018/verify.mjs
```

## 文件

- `map.json`：规范化地图
- `verify.mjs`：复验脚本
- 实验环境：`src/experiments/decoy-environment.js`
- 研究记录：`docs/archive/research/decoy-lure-20261018.md`
