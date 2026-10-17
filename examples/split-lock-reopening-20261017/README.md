# 《转圜》

单层23格、双鬼，只有A一组字母机关，两个按钮、五扇A门、一扇普通门、一个单向门和一把钥匙。出生点与目标相邻隔墙；最优37步，按每一步鬼位及停顿分成六种解法。开局可先观察，全部最优边界与指定实际入场通过。**尚无真人评价，未入地图集。**

[试玩](https://ghostmaze.novic.cc/?map=AADAOfn54eAAAAEIICQcAdASgEYBUVLgccAUAFUAAAAArMRxyIw1EIIQAAAAAEAEBBBg)

<details><summary>设计预期与参考（含答案）</summary>

直接把追逐队列一并送进右侧，关门当步安全，却失去之后重新打开与返回的条件。第一次闭锁必须只留下其中一只在右侧，另一只先安置在普通门旁。

这项安置也不是最终处理：右A同时打开了原先保护它的A门。回来使用左A以前，需要从下方再次引动这只鬼、调整接近方向；到达按钮时，借左A关闭身后保护，并开放右侧通路。参考最后带着放出的追鬼，借它的当前视线优先，阻挡原来那只的旧位置追击，从下方回路脱身。

预期认识是：**分开队列不仅服务眼前闭锁，还要为之后重新取得控制、重新分配追逐角色留条件。** 后半段仍使用已有的借鬼思想；本稿额外检验的是闭锁数量、保护失效与重开之间的整体安排，不把重复卡位或两个按钮本身算新意。

原图穷尽核对：第一次A捕获零只或两只、完全不用A、第一次闭锁后永远搁置段外鬼、完全不用当前视线优先，均不能无伤无复活通关。正确参考中首次留一只在右侧。直接全送入的实际安全前缀穷尽无续解；取钥匙后尝试从下方返回，会出现一眼可查的无安全下一步局面。这些是物理证据，不是人的顿悟报告。

- [37步参考1](https://ghostmaze.novic.cc/?map=AADAOfn54eAAAAEIICQcAdASgEYBUVLgccAUAFUAAAAArMRxyIw1EIIQAAAAAEAEBBBg&replay=GJVmRvBWPPaWyApX8DyA)
- [37步参考2](https://ghostmaze.novic.cc/?map=AADAOfn54eAAAAEIICQcAdASgEYBUVLgccAUAFUAAAAArMRxyIw1EIIQAAAAAEAEBBBg&replay=GJVmRvBWPPaWjApX8DyA)
- [37步参考3](https://ghostmaze.novic.cc/?map=AADAOfn54eAAAAEIICQcAdASgEYBUVLgccAUAFUAAAAArMRxyIw1EIIQAAAAAEAEBBBg&replay=GJVmRvBWPPaWgwpX8DyA)
- [37步参考4](https://ghostmaze.novic.cc/?map=AADAOfn54eAAAAEIICQcAdASgEYBUVLgccAUAFUAAAAArMRxyIw1EIIQAAAAAEAEBBBg&replay=GJVmRvBWPPaWyApX8MyA)
- [37步参考5](https://ghostmaze.novic.cc/?map=AADAOfn54eAAAAEIICQcAdASgEYBUVLgccAUAFUAAAAArMRxyIw1EIIQAAAAAEAEBBBg&replay=GJVmRvBWPPaWjApX8MyA)
- [37步参考6](https://ghostmaze.novic.cc/?map=AADAOfn54eAAAAEIICQcAdASgEYBUVLgccAUAFUAAAAArMRxyIw1EIIQAAAAAEAEBBBg&replay=GJVmRvBWPPaWgwpX8MyA)

</details>

## 精简、外形与证据范围

19格分队构件仍偏简单，未交付。首次保护会随闭锁打开的改稿，最初因提供多个普通门能分别安置、不用A就赢；删去两个独立保护门并核对取物条件，才形成跨阶段关系。最后两扇A分别及联合删除后，37步和五项全解条件保持；采用五门版，全部最优重新验证。

移动目标填掉出生与出口间的凹口，保持23格，活动区为6×5。保存容器沿用现行合法8×8，没有改规则或分享协议。内部(1,3)能删而仍37步，但会形成不美观的封闭虚空，保留完整下方轮廓；删(1,2)反而多两步，不为少一格增加赶路。不宣称全局最小，失败稿和反例均保留。

六条物理最优全部无非死亡重合、去终点安全；冷初态与指定实际入场逐步一致。1454可达局面含致死动作，14440次排列／变编号后继一致。无玻璃或楼梯，没有依赖内部编号。机器证据不自动意味着精妙或高挑战，不继承母图评价，也未加入训练。

`node examples/split-lock-reopening-20261017/verify.mjs` 从格子表重建并复算：原生／快求解最优、六种含停顿鬼轨迹、全部最优边界、去终点、入场、码往返及上述完整历史限制。

入场只声明第0层外部(2,0)向右一步到出生(3,0)，零钥匙、无外部鬼、其余外边封闭；整图接入另验。亲缘仍保守合并既有双鬼协作家族，不把本图算更多独立质量样本。

[地图](map.json) · [生成来源](source.json) · [证据](evidence.json) · [入口](share.json) · [研究与反例](../../docs/archive/research/split-lock-reopening-20261017.md)
