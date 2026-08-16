# ghost-maze-ai · 鬼迷宫 AI 地图生成器训练工作区

## 项目定位

「鬼迷宫」(Ghost Maze) 是一个 HTML5 解谜游戏（原仓库：`e:\编程\ghost-maze`，在线版 https://ghostmaze.novic.cc）。本仓库是**独立的 AI 训练工作区**，目标是训练出一个能生成**极高可玩性、甚至涌现人类没想到的精妙解谜设计**的地图生成 AI。**效果优先。**

## 协作守则（用户明确要求，必须严格遵守）

1. **训练方法论必须与用户探讨清楚**：方法的基本逻辑、训练方向、评估标准的任何重大改动，都必须先与用户讨论确认，由用户把关。**用户拍板后**，代码细节、实现方式由 AI 全权负责。
2. **产品决策由用户定夺**：解谜要素范围、游戏模式、可玩性优先级、地图尺寸等产品决策，AI 不得擅自扩展或变更。
3. **效果优先**：一切以产出高质量地图（解谜巧妙、可玩性高）为准绳。任何"听起来高级但效果差"的方案都不要。
4. 所有对话、文档、代码注释使用中文。

## 分阶段路线图（用户把关的产品决策）

### 阶段一（当前，严格限定）

| 维度 | 限定 |
|---|---|
| 地图尺寸 | **仅 10×10** |
| 游戏模式 | **仅 death-loop（死亡循环）**：可多次死亡试错，目标是用尽可能少的步数无伤通关 |
| 解谜要素 | **鬼（核心）+ 三要素**：门 DOOR、钥匙、数字门 LOCKED |
| 可玩性优先级 | **解谜的乐趣（巧妙解法的趣味性）**优先：最优解非显而易见，需要思考钥匙序/路线取舍/穿门甩鬼时机 |

**鬼是最基本的要素，是鬼迷宫的关键，解谜必然围绕鬼设计**——三要素与鬼配合产生基本解谜设计（如穿门甩鬼 = DOOR×鬼；威胁下的钥匙取舍 = 钥匙/LOCKED×鬼）。

生成的地图必须通过 `validate-map` 四道硬门（见下），且设计意图聚焦"围绕鬼的解谜"。

### 阶段二（后续，本次不实施）

- 新解谜要素逐个引入（单向门、玻璃、字母门+按钮、楼梯、多层…），每个新要素带来全新设计空间（引入前必须与用户讨论确认）
- 情绪体验乐趣（黑暗中时刻警惕鬼的紧张感）→ 探索模式（exploration）更配合；与解谜乐趣可兼得

## 训练方法论：生成-验证-评审-反馈循环

```
┌─ 生成层（Claude = 游戏设计师）────────────────────────────┐
│  ① 读经验库（data/experience.md + 最近反馈）               │
│  ② 构思「设计意图」：谜题核心？玩家决策？机制组合？(涌现载体) │
│  ③ 落地为 mapData JSON（阶段一：10×10 + death-loop + 三要素）│
├─ 验证层（算法硬门，不可妥协）─────────────────────────────┤
│  ① 结构合法 mapDataValidator   ② 结构可解 isStructurallySolvable │
│  ③ 无伤可通 solveMap（带鬼 A*）④ 威胁实质 解法被鬼盯 ≥1 步   │
│  不过 → 分析原因 → 修改或重新构思                           │
├─ 评审层（Claude 设计师视角，阶段一核心：解谜趣味性）─────────┤
│  最优解的非显然性（绕路/回头/钥匙序特征）/ 设计意图达成度 /  │
│  决策深度 / 公平性 / 涌现新颖性                             │
├─ 反馈层（真人 = 用户）────────────────────────────────────┤
│  导出分享码 → 用户进游戏试玩 → 反馈（谜题巧不巧/卡点/无聊）  │
└─ 经验库（积累 = 训练的本质）──────────────────────────────┘
     每张图全记录：data/maps/ 存档 + data/experience.md 教训
     → 指导下一轮生成（越训练越强）
```

详细协议见 [docs/methodology.md](docs/methodology.md) 与 [docs/review-protocol.md](docs/review-protocol.md)。

## 仓库结构

```
src/engine/     规则引擎快照（只读，来自原游戏；simulator 双跑一致性的对照源）
src/validate/   验证层（wallIndex/simulator/solvabilityVerifier/solver/mapDataValidator）
src/tools/      CLI 工具（validate-map / to-sharecode / record-feedback / sharecode）
docs/           方法论文档（methodology / map-format / review-protocol）
data/maps/      生成地图存档（地图+设计意图+验证+评审+反馈 全记录）
data/feedback/  用户试玩反馈记录
data/experience.md  经验库（训练循环的「记忆」，生成前必读）
test/           验证层测试（npm test）
examples/       示例地图（demo-map.json）
```

## 常用命令

```bash
npm test                                     # 跑验证层测试（含 simulator 与真实 gameLogic 双跑一致性）
npm run validate -- <map.json> [--json]      # 四道硬门验证
npm run sharecode -- <map.json> [--verify]   # mapData → 分享码（粘贴进游戏试玩）
npm run feedback -- <map.json> "<评语>" [得分]  # 记录用户试玩反馈
```

## 验证层核心事实（迁移自原仓库 AI 管线，勿偏离）

- 墙索引约定：`hWalls[y][x]` = 格 (x,y) **上方**的墙；`vWalls[y][x]` = 格 (x,y) **左侧**的墙。hWalls 是 (height+1)×width，vWalls 是 height×(width+1)。
- 墙类型（constants.js WALL_TYPES）：EMPTY=0 / SOLID=1 / DOOR=2 / LOCKED=3 / ONE_WAY=4 / GLASS=5 / LETTER_DOOR=6。
- 玩家通行/鬼通行/鬼视线是**三种不同判定**（wallIndex.js）：DOOR 玩家可穿、鬼不可穿、挡双方视线；GLASS 双方不可穿但**不挡视线**；已开 LETTER_DOOR 挡玩家视线但鬼可看可穿。
- 鬼 1:1 同步移动，直线视线（同行/同列无墙）触发追捕，失去目标只朝玩家上一位置走 1 步（无记忆），看不到玩家完全不动。
- `simulator.js` 复刻 gameLogic 全部规则且状态可哈希（AI 管线唯一规则源）；与 gameLogic 的双跑一致性由 test/simulator.test.mjs 锁定。
- 求解器 solveMap 返回 `{ solvable, confidence, moves, minSteps, solutionFeatures }`；confidence 为 'optimal'（限界 A* 最优）或 'approx'（超预算降级贪心，**非最优**，评估时注意）。

## 已实证的设计知识（来自 demo 开发与旧管线经验，进 experience.md 持续积累）

- **直线走廊 + 鬼端头 = 1:1 追尾必被咬**：玩家被盯后直线逃跑，鬼距恒 1 格。甩鬼必须靠"穿门（DOOR 挡视线挡鬼）或转角（转弯后鬼失去视线）断视线"。
- **威胁路径必须比安全路径短**：若威胁路径与安全路径等长/更长，求解器与玩家都会选安全路径，威胁成为纸老虎（threat 硬门不过）。"近路被盯 vs 远路绕行"的取舍环是威胁成立的必要条件。
- 旧 AI 管线（原仓库 archive/ai-pipeline-v1 分支）的失败教训：人工权重评估被 Goodhart、带鬼 A* 状态空间爆炸降级贪心、搜索空间过小 → 本仓库改用 LLM 生成 + 硬门把关 + LLM 评审 + 用户反馈。
