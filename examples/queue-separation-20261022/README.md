# 《门庭》· 新候选

33格、7×7包络，两只鬼、同一组A门和一把钥匙。中央房间与外侧通路相连，开局没有追逐。尚无真人评价，未入地图集，未训练或自动调用试玩技能。

[无剧透试玩](https://ghostmaze.novic.cc/?map=AADB4SFx_X0l_AFVyAkGQA2AlQDwFUCgK5BCiGRXKFKKqoAQgqoKiE4cSoqVVUgIAAQEEAA)

<details>
<summary>设计预期、反例与参考解法（含答案）</summary>

两只鬼共用一个房间、四个反相入口。先把一只引出去关门的熟悉计划，会失去后续取钥匙的条件。预期的发现是先让两只鬼排成一列，再关闭夹在它们中间的门，把它们分留在房间内外；最后从另一侧接近房间，调开内部追者，绕到钥匙背面。这不同于招回一只鬼争位挡另一只，参考解没有争位。

初次从西边开A、直接去北边拉出第一只、在东边开门后立即关闭，三个实际安全前缀都没有任何无伤续解。这是设计者的引擎核对，不是玩家实际尝试。原图禁止上述同列分隔事件，允许或禁止非最优重合的完整查询都穷尽无解；这些只界定解法关系，不证明新意或人的顿悟。与《调度》仍共有空间调动思想，是否带来新认识尚待真实体验。

原37格草图把终点放得过远，取钥匙后还需走很长一段并追加一次开A。现将终点移到正常出口旁，出生内移，再删一格未使用的突出部分，成为33格；没有用往返次数或多余元件增加难度。

[46步参考回放](https://ghostmaze.novic.cc/?map=AADB4SFx_X0l_AFVyAkGQA2AlQDwFUCgK5BCiGRXKFKKqoAQgqoKiE4cSoqVVUgIAAQEEAA&replay=EA7fn5D_AjVqqAgP6lb3j9A)

</details>

最优46步，唯一含停顿鬼轨迹；全部最优无伤、无复活、无非死亡重合，去终点安全。指定外部(2,5)向下一步入场，初态与整条最优的内部物理局面保持；1628个可达局面、两种排列及变编号的16080次后继对照含死亡动作一致。共同原生与快速环境、分享码与操作码往返通过；无玻璃或楼梯。本地原站渲染检查无异常，没有改动网站或检查正式部署。

[独立构造](build.mjs)、[完整证据](evidence.json)、[原图查询](analyze.mjs)和[来源](source.json)。运行 `node examples/queue-separation-20261022/verify.mjs` 复验；失败构思与精简过程见[研究清单](../../data/manifests/shared-room-and-three-way-counterexamples-20261022.json)。
