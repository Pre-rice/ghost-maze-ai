# 《楼间》规则修补版

2026-10-14。两层共11格、一鬼、一个A按钮、两扇同相A门、两对楼梯，无钥匙、普通门或玻璃。曾维护已选入的基础多层入门位置；2026-10-14用户因“每步操作都几乎只有一种选择，毫无思考难度”撤出地图集。[原话及复盘](../../docs/archive/reviews/multilayer-rejection-20261014.md)。用户对[原版](../stair-relocation-20261013/README.md)的评价保留，生成时humanQuality:null保持；新的定性负反馈另存，不补造数值分。

[正式站试玩](https://ghostmaze.novic.cc/?map=AWN4wMDAwOR8gIGBiYGBgcVhgQcDGDCt4nAAMzjkQKQLkwILkG7Y6agBkWdllGmAsBQcAA)。网站“求解”提供全部最优路线；下文含关键。

<details>
<summary>修补依据与参考（含答案）</summary>

只把初始鬼后移会让玩家四步直达终点，因此同时把目标A门初态改为关闭；原布局、按钮与楼梯不增加。打开A会把鬼释放到上层，玩家不能直接取目标。先离开上层，从另一处楼梯把鬼引近，再立即下楼；鬼随后从楼梯追来，玩家沿下层绕回原楼梯返回上层，并利用转向保持距离抵达目标。

每只鬼一回合只走一步。玩家走到对端有鬼的楼梯口会当步死亡，上下楼时到达层鬼也正常行动。本图使用这一规则，没有楼梯停顿、编号、重合或提前判胜漏洞。

普通门在修补后删去也保持19步、原最优动作与核心关系，故去除。最短19且唯一；所有无伤无复活通关都需至少两次鬼跨层。去掉终点重放仍安全。五个可删非实体格中，桥接格删除会无解，隔离鬼的连接格删除会退化为5步直达，不是冗余格。

[参考回放](https://ghostmaze.novic.cc/?map=AWN4wMDAwOR8gIGBiYGBgcVhgQcDGDCt4nAAMzjkQKQLkwILkG7Y6agBkWdllGmAsBQcAA&replay=NnxkDKcpsteXxcA)。这是一版入门关维护，不能把机械必要性或亲缘原版的好评当作新顿悟证据。

</details>

重验：`node examples/stair-relocation-repair-20261014/verify.mjs`。地图／操作码完整往返，全部最优边界、指定真实冷入口与去终点安全通过；原版地图、生成时评价字段和证据不覆盖。同原版放入同一保守家族，不新增独立质量样本，未启动模型训练。
