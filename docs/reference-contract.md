# 参考环境与三态求解约定

2026-10-12 地图交付检查采用全部并列最优解的重合审查，夹击死亡和非最优重合允许；玻璃换墙仍核对全部物理策略。具体范围见 [最新边界审查](rule-boundaries-20261012.md)。

更新：2026-10-12。游玩、AI、回放共用同级本体；规则内容固定于 `engine.lock.json`。当前实现面向全信息、无伤、无复活的物理解验证，不是仿真人迷雾策略，也不是高性能训练模拟器。

## 环境

入口：[createReferenceEnvironment](../src/reference/environment.js)。接收纯 `mapData`，支持当前编辑器范围：8–20 格画布、1–10 层、现有墙类型、钥匙、鬼、按钮和配对楼梯。构造时检查结构、实体坐标与相关参数，冻结独立的 `MapDefinition`，不修改输入对象。

```js
const env = createReferenceEnvironment(mapData);
const initial = env.initialState();
const next = env.step(initial, 'U');
const key = env.stateKey(next);
const replay = env.replay(['U', 'D', 'L']);
```

动作是 `U / R / D / L / STAIR` 字符串。成功移动、原地按钮与楼梯均计一步；体力已取消。搜索可关闭动画与视野计算以减少成本，物理迁移仍调用同一 GameLogic。按钮只能在相应位置朝其方向操作；不开放远程 `PRESS_BUTTON`、任意位移、复活或撤销。无效动作返回同一状态；合法但危险的动作可以产生死亡状态，不会被接口偷偷屏蔽。

`replay` 拒绝无效动作、死亡和终止后的额外动作，返回末状态、成功动作数 `totalActions` 与移动/楼梯成本 `movementCost`。它允许非终点的合法前缀，用于单元出口分析；调用方仍需检查 `state.isWon`。求解器在返回成功前会自行完成胜利重放检查。

环境状态是原引擎的 `GameState`，应只使用本环境的初态与后继，不手工修改状态后用于正式证书。

## 完整物理状态键

键包含地图标识、玩家楼层和位置、生命、钥匙、胜负标志，以及所有层的有序鬼位置、有序剩余物品和完整动态墙状态。

引擎后继已与鬼编号和排列无关。参考搜索仍保守保存鬼排列，以兼容明确指定身份的研究监控；这只可能减少去重，不是物理优先权。通用边界审查按鬼位置排序但保留同格数量。物品不能只记录总数，生命与钥匙不能省略。相同位置与机关状态，不一定有相同的后续能力。

省略动画轨迹、已探索区域、步数、循环数和复活标记。这些字段不影响本接口允许动作的物理后继；代价由搜索层另行记录。本键不能用来合并人类知识状态或含复活、回溯的过程。反事实监控的事件历史由搜索层另外加入完整键。

`mapId` 是严格规范地图 JSON 的 SHA256 内容哈希，不是关卡语义等价判定。字段表示和默认值改变可能得到新标识；分享码发布仍要解码后重新重放动作，不能只比较地图哈希。

## 求解

入口：[solveReferenceMap](../src/search/reference-solver.js)。当前为完整物理状态 BFS，优化成功动作数 `T`，即产品步数。移动／楼梯成本 `L` 单独统计，不代替按钮在内的总步数。

```js
const result = solveReferenceMap(mapData, {
    nodeBudget: 10000,
    stateBudget: 2500,
    budgetMs: 2000
});
```

| 字段 | 含义 |
| --- | --- |
| `status` | `solved`、`proven_unsat` 或 `unknown` |
| `reason` | 找到目标、穷尽前沿，或哪种预算导致中断 |
| `ruleset`、`mapId` | 规则内容锁与规范化地图标识 |
| `scope` | 实际游戏模式、无伤无复活目标、动作集合和优化指标 |
| `optimality` | 当前 BFS 找到的解为 `proven`，其他情况为 `null` |
| `solution` | 成功时的动作名称数组、`totalActions`、`movementCost`；否则为 `null` |
| `search` | 展开数、尝试动作数、已保存状态数、耗时、预算及是否穷尽 |

- **`solved`**：找到并重放成功；BFS 首次发现目标给出最小成功动作数，不另外保证移动成本 `L` 在所有最短动作解中最小。
- **`proven_unsat`**：所有允许的非死亡可达状态均已展开且没有胜利状态。结论限于声明的无伤无复活范围及实际资源；探索模式可能有利用复活的解，不在这里讨论。
- **`unknown`**：节点、累计保存状态或搜索时间预算耗尽，不能作为无解标签。

地图输入、预算或运行错误抛异常，不混入三态标签。环境可以用于没有终点的单元前缀分析，但求解入口要求至少一个终点。

`nodeBudget` 是展开次数；`stateBudget` 是累计保存的去重状态上限，不是精确字节内存限制，也不包含直接返回的胜利节点。时间预算只约束搜索循环，不包含环境初始化和证书重放；单次引擎调用不强制抢占。不要据此宣称硬实时或硬内存上限。

这个参考版优先正确与可审查性，使用共同引擎局面；大图可能在预算内返回未知，不能推断训练吞吐或收敛速度。
A* 使用同一物理规则，保留自己的队列、布局和紧凑状态索引，见 [快验证约定](fast-verification.md)。BFS 继续保留为对照；A* 的预算内证书可以标为 `not_proven`，不能把所有 `solved` 都解释成已证最优。

两个入口现均接受 `restrictions`，将禁止事件序列的监控进度加入搜索状态；结果的 `scope.restrictions` 保存实际条件。受限无解仅对该条件成立，不能冒称原图无解。事件语义与证明边界见 [反事实分析](design-search.md)。

## 命令行

```bash
npm run solve -- examples/puzzle-units/unit-01.json
npm run solve -- examples/puzzle-units/unit-02.json --nodes 10000 --states 2500 --ms 5000
node src/reference/solve-map.mjs examples/puzzle-units/unit-01.json --nodes 0
```

直接调用 Node 时，标准输出仅包含 JSON；`npm run` 自身会打印命令横幅，机器消费结果时优先使用 Node 入口。兼容纯地图和含 `mapData` 的包装记录。

退出码：`0` 已解、`1` 已证明无解、`3` 未知、`2` 输入或运行错误。旧 `validate:legacy` 保留，不将它的 `solvable:false` 映射到新约定的 `proven_unsat`。
