# A* 与共同规则验证

更新：2026-10-11。BFS、A*、游玩和回放的物理迁移全部调用同级本体 GameLogic。当前内容锁为 `sha256:5cbe15023dbe0892c58febad1e399cf8cc81266a09c57cca210777124f2ffec5`，细目在 `engine.lock.json`。

## 入口与职责

```text
npm run solve -- examples/puzzle-units/unit-02.json
npm run solve:fast -- examples/puzzle-units/unit-02.json
npm run solve:fast -- examples/puzzle-units/unit-02.json --nodes 0
```

[参考 BFS](../src/search/reference-solver.js)与[A*](../src/search/fast-solver.js)是不同搜索算法，共用物理实现。旧[simulator 入口](../src/validate/simulator.js)现在只装配地图、动态门索引、BigInt 位图和状态键；step 直接调用共同引擎，不另写移动、鬼、按钮、拾物、视野和胜负。

搜索禁用动画轨迹和显示用视野，证书按相同物理重放；视野仍由共同引擎用于实际游玩和回放。数字门与字母门的动态索引采用 BigInt，超过 32 个门不碰撞。墙与视野采用写时复制，父态和兄弟分支不能受子状态污染。

## 状态与预算

体力已取消，移动、按钮、楼梯均计一步。状态键保留生命、钥匙、胜负、玩家位置、各层有序鬼与物品、动态门；省略探索、动画、步数与循环，路径成本由搜索层保存。额外事件监控进度必须进入完整键及支配分组。

下界使用所有层终点的多源 BFS，包含配对楼梯；放宽锁门、单向门、字母门和按钮占用，保留实墙、玻璃与活动格。它是乐观下界，不代替真实动作校验。

结果沿用[三态约定](reference-contract.md)：

| 情况 | 结果 |
| --- | --- |
| A* 正式取出目标节点 | solved，optimality: proven |
| 预算中断但已有可重放解 | solved，optimality: not_proven |
| 预算中断且无证书 | unknown |
| 乐观距离仍不可达 | proven_unsat，relaxed_unreachable |
| 前沿穷尽 | 已解或 proven_unsat |

时间预算是软限制，环境准备与证书重放不计入搜索循环时限；状态数不是精确字节内存上限。贪心失败或超时不能标为无解。

旧 API 的 solvable 为 true／false／null，null 表示未知；minSteps 为证书总步数，移动成本另看 movementCost。withGhosts:false 是去鬼诊断，不是原图无伤证书。

## 剪枝与验收

支配判断只在其他物理状态与历史监控进度一致时比较路径成本和生命；不存在体力维度。含知识、复活或新资源事件时必须重新审查，不能把物理去重键冒充知识状态键。

现有回归覆盖固定种子随机动作、两模式、多层、按钮、鬼顺序、门位图、父子状态隔离、最优性和预算边界。当前 AI 全套 126 项通过，两个原种子内容保持，证书、新码与单元出口重放通过；试玩包不能通过提前规范化绕过原始地图冲突校验。

每张 AI 题的日常闸门为地图合法性、新码往返、共同引擎证书与胜利、操作码往返。无需每次再在真实浏览器整段通关；规则或交互改动时做代表性浏览器验收。BFS／A* 一致证明搜索结论在该范围一致，不再声称两套物理独立差分能证明规则正确。

## 性能证据边界

旧文档的 2026-09-24 BFS／独立快模拟中位耗时是旧规则、旧实现的历史测量，不能沿用于当前 A*。本轮未重跑搜索性能或训练，不能宣称共同引擎让所有求解普遍加速。

当前回放与加载的浏览器实测在[本体交付记录](../../ghost-maze/docs/architecture-delivery-20261011.md)：资源已加载、前台本地设备，20×20 十层的 1000／2000 步跳步达到已批准目标。
