# 当前状态

更新：2026-10-18。目标是有可推断尤里卡时刻的好谜题，训练是可选路线。

## 当前任务与停点

用户2026-10-18评价《腾挪》仍是旧思路，要求先完成阶段性收尾，再暂停主线，提出当前十六张精品地图的学习、进化与打破经验排序及理由。**中央开关研究已完成留档；停止设计、生成与训练，[十六图排序提案](archive/reviews/gallery-order-proposal-20261018.md)已完成，等待本轮审核。** 本轮不改网站顺序、地图内容或已确认方案。

## 作品状态

- 新候选《腾挪》：19格双鬼，一个A按钮及两扇A门、一扇普通门、一把钥匙；41步、三种含停顿轨迹。全部最优边界、去终点、实际入场及排列／变编号通过，普通替代与组合精简留证。[来源](../examples/corner-clearance-20261018/README.md)。用户评价“新地图没什么新意啊。还是老的思路。”；不计新意进展、未入集。[实际反馈](../data/manifests/corner-clearance-review-20261018.json)。
- 精品地图十六张；最新《布阵》按原码入集，最优58步、两种含停顿鬼轨迹。用户评价“不错”，但比上一张少一点新意和巧妙性；不补写具体顿悟。[实际评述与快照65](../data/manifests/staged-workroom-review-20261018.json)。
- 《调度》在关门追击修正规则下最优70步、四种轨迹，用户认为“甚至更妙”“核心思想几乎完全不变”；原图不改。《后路》按用户决定撤出。[当前证据及判断修正](../data/manifests/inside-shunting-current-review-20261018.json)。
- 唯一规则锁为 `sha256:762b163064dac2464603c002d5a46782675f0a78274e93f68aa36555683cd91a`。67份公开原件审查已完成，原种子保持；现行边界见[设计边界](design-boundaries.md)。
- 作品、历史候选和真实评述统一在本仓[地图总目录](ai-map-catalog.md)；精选设计摘要见[人读小册](https://github.com/Pre-rice/ghost-maze/blob/main/docs/map-design-guide.md)。

## 研究判断与资料

- 中央单开关研究已实现18步同步闭锁构件，但不闭锁也有22步无重合通关，第三鬼仍能独立处理；仅作构件保留，不以此再交付相似挑战题。原型、最优重合反例及筛选依据见[冻结记录](../data/manifests/central-control-20261018.json)，尚未做完整交付QA或质量标注。
- 近期《送客》《互锁》《转圜》均未形成用户认可的新意；必要性、跨阶段安排或多个鬼不能替代实际挑战评价。反馈已提炼至[方法](methodology.md)，不继续交付相似构件。
- [空间安排研究](archive/research/spatial-control-20261018.md)及自动安排诊断保留原型、失败与反例；工具只提供机械证据，不作为趣味分或求解前自主规划能力。
- 旧规划模型与行动段对照没有原生搜索替代收益，未据此替换现有方法；本轮未新增模型训练。历史15张规划图653行及亲缘拆分保持。[历史清单](../data/manifests/planning-library-20261014-v12.json)。
- 原图、生成来源、真人反馈与 QA 分别保存；中央开关研究另存 cloud-data-20261018-planning-67.zip，校验见[冻结记录](../data/manifests/central-control-20261018.json)；本次实际反馈另存 cloud-data-20261018-planning-68.zip，校验见[实际反馈清单](../data/manifests/corner-clearance-review-20261018.json)；未称用户已下载。付费与 GPU 不自动启动。

整理前的完整状态及研究入口保留在[历史快照](archive/worklogs/status-before-repository-separation-20261018.md)，无需为接手重跑已完成研究。
