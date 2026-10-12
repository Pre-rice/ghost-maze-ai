# 《借道》

更新：2026-10-13。22格、两鬼、两钥匙；一扇普通门、两道0门和出口2门，没有按钮或玻璃。开局与进入区域的当步均中性。新候选未上架九图地图集，暂无真人评述与路线，`humanQuality:null`。

[试玩](https://ghostmaze-ui-preview-20261012.prerice.chatgpt.site/?map=AADIAHwo-Ln4AAEkICAsBA8AFVCSKQacJAqqAAAABHdBVCCFRECAAAAAAAg)。默认保持迷雾，初态和桌面／手机入口已核验。

<details>
<summary>参考解法与设计说明（含答案）</summary>

[参考回放](https://ghostmaze-ui-preview-20261012.prerice.chatgpt.site/?map=AADIAHwo-Ln4AAEkICAsBA8AFVCSKQacJAqqAAAABHdBVCCFRECAAAAAAAg&replay=AMmRO4T_xgqXzwLVaoPC_w)，默认暂停。最短44个有效动作；独立A*／BFS一致，全部并列最优解均不经过非死亡鬼重合。

需要先拿右下钥匙，提前打开下方0门，再安排左侧普通门上方的鬼，才打开上方0门释放守钥匙的鬼。回程中两鬼先后互相挡住，提前打开的下门使走廊鬼能向下退入停位，为玩家留出上行取钥匙的通道；同一普通门两面先后停放不同的鬼。编号不是行动优先条件。

八项关系逐一禁止，两个独立求解器均穷尽无伤无复活范围而无解，见[evidence.json](evidence.json)。钥匙事件绑定物品坐标，门事件绑定具体边；不将“曾发生”误写成唯一走法或人类难度。少准备下门的22步安全前缀仍未死亡，但后续24个可达搜索状态内无解；这是活着的困局，不能称为大规模复杂分支。

下门换成空边，母图最短42；改普通门仍有34步解，说明是另一种题而非不可玩；改实墙无解。保留下门的理由是引入必须提前为鬼开路的关系，不能宣称“删任一机关就无解”。出口2门负责取齐两钥匙；去掉出口门10步可结束，这只是任务约束。固定八项关系后逐项删格／元素／空边简化未找到更简布局；该结论仅在声明编辑和保留条件范围内成立，不是全局最小。

[地图](map.json)、[证据](evidence.json)、[动作与分享码](share.json)、[来源与家族](source.json)、[条件精简记录](minimization.json)、[浏览器关键局面核验](browser-check.json)。实际单向入场、原机关初态、零钥匙且区域外无鬼时，玩家／鬼／物品／区域内机关逐步一致；新增外格和入口边界不是原单元内部墙。分享码往返、编号顺序互换、去掉目标后完整路线均通过。

[求解器资料制备](../../docs/solver-data-20261013.md)已完成44个全信息状态样本，来源与版本见[data-preparation.json](data-preparation.json)，只监督一条最优延续，质量分为空、未训练。

所有亲缘母图、删门、换门对照均归同一 `door-cooperation-20261013-v1`，不算独立真人质量样本。不启动模型训练；未来训练拆分必须按家族隔离，不能将参考动作证书当“精妙”标签。

复核：`node examples/borrowed-route-20261013/verify.mjs`，只读当前地图与既有记录，不覆盖历史证据。

</details>
