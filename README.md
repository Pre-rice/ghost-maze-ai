# ghost-maze-ai · 鬼迷宫 AI 地图生成器训练工作区

为解谜游戏「鬼迷宫」（[https://ghostmaze.novic.cc](https://ghostmaze.novic.cc)）训练一个**能生成极高可玩性、甚至涌现人类没想到的精妙解谜设计**的地图生成 AI。

## 核心思路

**LLM 生成 + 算法硬门把关 + LLM 评审 + 真人试玩反馈** 的迭代训练循环：

- **生成**：Claude 以游戏设计师身份构思「设计意图」（谜题核心/玩家决策/鬼的剧本），再落地为地图
- **验证**：四道算法硬门不可妥协（结构合法 / 结构可解 / 无伤可通 / 威胁实质）
- **评审**：Claude 以设计师视角按协议评审（解谜趣味性 / 决策深度 / 公平性 / 新颖性…）
- **反馈**：你亲自试玩是最终裁判，反馈沉淀进经验库
- **积累**：`data/experience.md` 经验库让生成质量随训练轮次持续提升

完整方法论见 [docs/methodology.md](docs/methodology.md)。

## 当前阶段（阶段一）

仅 10×10、仅 death-loop 模式、仅鬼 + DOOR/钥匙/LOCKED 三要素，主打**解谜乐趣（巧妙解法的趣味性）**。后续阶段逐个引入新要素（见 [CLAUDE.md](CLAUDE.md) 的分阶段路线图）。

## 快速上手

```bash
npm install              # 唯一依赖：pako（分享码压缩）

npm test                 # 验证层测试（含 simulator 与真实游戏规则双跑一致性）
npm run validate -- examples/demo-map.json     # 四道硬门验证
npm run sharecode -- examples/demo-map.json    # 地图 → 分享码，粘贴进游戏试玩
npm run feedback -- examples/demo-map.json "评语" 8   # 记录试玩反馈
```

## 目录

```
src/engine/      规则引擎快照（只读，来自原游戏）
src/validate/    验证层（simulator/求解器/可解性/结构校验）
src/tools/       CLI 工具
docs/            方法论文档（方法论/地图格式/评审协议）
data/maps/       生成地图存档（全记录）
data/experience.md  经验库
examples/        示例地图
test/            验证层测试
```

## 训练循环速览

```
读经验库 → 构思设计意图 → 落地 mapData → 硬门验证（不过则改/重来）
→ LLM 评审 → 你试玩反馈 → 归档 + 提炼教训 → 下一轮
```

每次训练前请阅读 [CLAUDE.md](CLAUDE.md)（协作守则）与 [docs/methodology.md](docs/methodology.md)（完整协议）。
