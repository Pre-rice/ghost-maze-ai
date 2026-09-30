# 地图格式规范（mapData）

> AI 生成器输出与游戏 `startGame(mapData)` 完全同构的对象。墙索引约定极易出错，务必反复核对。

## 一、墙索引约定（最重要）

- `hWalls`：`(height+1) 行 × width 列`。`hWalls[y][x]` = 格子 (x,y) **上方**的墙；`hWalls[y+1][x]` = 其**下方**的墙。
- `vWalls`：`height 行 × (width+1) 列`。`vWalls[y][x]` = 格子 (x,y) **左侧**的墙；`vWalls[y][x+1]` = 其**右侧**的墙。
- 示例：格 (5,8) 与格 (5,7) 之间的墙（下方格的上方）= `hWalls[8][5]`。
- 格 (4,7) 与格 (5,7) 之间的墙（右格的左侧）= `vWalls[7][5]`。

## 二、墙对象

```js
{ type: 0 }                          // EMPTY：无墙
{ type: 1 }                          // SOLID：双方不可过，挡视线
{ type: 2 }                          // DOOR：玩家可过，鬼不可过，挡双方视线（逃生门）
{ type: 3, keys: 1 }                 // LOCKED：需 keys≥门值才可过，通过后永久 EMPTY；鬼不可过；挡视线
{ type: 4, direction: {dx,dy} }      // ONE_WAY：单向门（阶段二）
{ type: 5 }                          // GLASS：双方不可过，但不挡视线（阶段二）
{ type: 6, letter, initialState }    // LETTER_DOOR：按钮开关门（阶段二）
```

墙类型常量见 `src/engine/constants.js` 的 `WALL_TYPES`（EMPTY=0 / SOLID=1 / DOOR=2 / LOCKED=3 / ONE_WAY=4 / GLASS=5 / LETTER_DOOR=6）。

## 三、mapData 完整形状（阶段一）

```js
{
  width: 10,
  height: 10,
  hWalls, vWalls,                     // 如上
  activeCells: [[true×10]×10],        // 可用格布尔矩阵（regular 模式全 true）
  items: [{ x, y, type: 'key' }],     // 钥匙（可多把）
  buttons: [],                        // 阶段一必须为空
  initialGhosts: [{ x, y, id }],      // 鬼（1-4 只）
  startPos: { x: 1, y: 8 },           // regular 固定左下 {1, height-2}
  endPos: { x, y },                   // 终点，唯一
  editorMode: 'regular',              // 阶段一固定 regular
  customStartPos: null,
  multiLayerMode: false,              // 阶段一固定 false
  layerCount: 1,
  layers: [],
  stairs: [],                         // 阶段一必须为空
  gameMode: 'death-loop',             // 阶段一固定 death-loop
  initialStamina: 100
}
```

存档格式（`data/maps/` 内）用包装结构：

```js
{
  name: '地图名',
  version: 1,
  stage: 1,
  designIntent: {                     // 设计意图（见 methodology.md 第 1 步）
    core: '谜题核心一句话',
    decision: '玩家决策点与取舍',
    ghost: '鬼的剧本',
    mechanisms: ['key-order', 'door-evasion'],
    tension: '紧张时刻'
  },
  mapData: { ... },                   // 如上
  validation: { ... },                // 硬门报告（validate --json 输出）
  review: { ... },                    // LLM 评审记录
  feedback: [ { time, comment, score } ]  // 用户试玩反馈
}
```

## 四、实体与机制语义（阶段一）

| 元素 | 玩家 | 鬼 | 解谜作用 |
|---|---|---|---|
| 钥匙 | 拾取 +1（全局共享） | — | 决定锁门可开性 |
| LOCKED | 钥匙数≥keys 可过，通过后消耗 | 不可过 | 空间分区 + 钥匙序决策 |
| DOOR | 可自由过 | **不可过** | 挡双方视线 → 穿门甩鬼 |
| 鬼 | 被抓 -1 体力回出生点（death-loop 可反复死） | 1:1 同步 | 威胁驱动决策 |
| 终点 | 站上即胜 | — | 目标 |

**death-loop 模式**：初始体力 100，每走 1 步 -1 体力；被抓回出生点（记忆保留）；目标 = 尽可能少步数无伤通关。

## 五、鬼 AI（决定地图设计的一切）

- 玩家每成功走 1 格，鬼同步走 1 步（1:1）。
- **直线视线**：鬼与玩家同行/同列且中间无阻挡墙（DOOR/SOLID/LOCKED/ONE_WAY 都挡，GLASS 不挡，已开 LETTER_DOOR 不挡）即看见玩家。
- 看见后沿 BFS 最短路径追；**失去目标只朝玩家上一位置走 1 步**（无记忆）；看不到玩家完全不动（无巡逻）。
- 设计推论：
  - 长直走廊 = 高威胁；多转角 = 庇护空间
  - 直线走廊被盯后逃跑必被追尾（1:1 恒距 1 格）→ 甩鬼必须靠**穿 DOOR** 或**转角断视线**
  - 威胁路径必须比安全路径短，否则威胁是纸老虎

## 六、生成合法性速查

- 10×10，坐标 x∈[0,9], y∈[0,9]；终点/实体必须在界内且非 activeCells=false 格
- 边界墙（hWalls[0]/hWalls[10]/vWalls[*][0]/vWalls[*][10]）应为 SOLID
- 钥匙必须在锁门**之前**可达（否则结构不可解）
- 每把 LOCKED 的 keys 值决定钥匙需求链（阶段一建议 1-2 档：1、2）
- 检查清单工具：`npm run validate`（四道硬门一站式）
