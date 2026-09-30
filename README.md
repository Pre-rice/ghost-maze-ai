# ghost-maze-ai · 鬼迷宫 AI 训练工作区

目标是在个人工作站或少量 GPU 条件下，生成值得反复推敲的高质量谜题。允许长时间训练与生成，优先死亡循环中的智力体验。

当前已完成 **P0 验证基础、反事实分析、自由编辑实验及首批成对试玩流程**：三个设计家族、可追溯修改链、3 组 6 图的本地试玩与反馈保存。尚未启动模型训练，也没有把机制证据当作人类趣味评分。

**最新试玩结论（2026-09-30）**：首批全部太简单、解法显而易见。下一步优先单层组合题，提高实际推理要求，暂缓机械扩大家族。见 [真实反馈复盘](docs/review-batch-01-findings.md)。

**当前待试玩**：[单层候选 01](examples/coupled-singlelayer/README.md)。本次只交一张重新筛选与精简的组合题，原引擎和浏览器已验证，实际巧妙程度等待用户反馈。

## 从这里开始

- [AGENTS.md](AGENTS.md)：Codex 项目指引与协作约定。
- [当前状态](docs/status.md)：已完成工作、旧管线风险与下一步。
- [参考环境与求解约定](docs/reference-contract.md)：动作、状态键、三态结果及预算边界。
- [快模拟器与 A*](docs/fast-verification.md)：修正项、差分覆盖、资源剪枝与性能记录。
- [具体训练方案](docs/ai-training-plan.md)：架构、数据、损失、奖励、课程和验收。
- [调研报告](docs/ai-puzzle-generation-research.md)：机制分析与研究依据。
- [两个小单元](examples/puzzle-units/README.md)：可试玩地图、解法与反例。
- [反事实分析与设计搜索](docs/design-search.md)：事件监控、原图必要性证明、有限编辑实验及边界。
- [互补开关与旁路对照](examples/mechanism-lab/README.md)：新的机制家族、可试玩地图和受控反例。
- [开始成对试玩](examples/review-batch-01/README.md)：运行 `npm run review`，在原版游戏中试玩并保存比较。
- [反馈格式与验证记录](docs/review-workflow.md)：原始选择、改评、导出及训练使用边界。

## 本地初始化与检查

使用支持 ES Module、node:test 的现代 Node.js（建议 Node.js 20 或更高版本）与 Git。

```bash
git submodule update --init --recursive
npm ci
npm run check
npm test
npm run verify:seeds
npm run solve -- examples/puzzle-units/unit-01.json
npm run solve:fast -- examples/puzzle-units/unit-02.json
npm run sharecode -- examples/puzzle-units/unit-01.json --verify
npm run analyze -- examples/mechanism-lab/complementary-switch.json examples/mechanism-lab/analyze-config.json
npm run search:design -- examples/mechanism-lab/complementary-switch.json examples/mechanism-lab/search-config.json
```

`npm run check` 检查引擎提交、工作区纯净状态和种子内容；`verify:seeds` 用原引擎重放证书，并验证分享码与移除终点后的单元出口。

`npm test` 分别运行参考/快实现对照和原有工具回归；模拟器一致性测试直接对照固定游戏引擎，历史地图生成器仅提供测试输入。

本次从同级本地游戏仓库引入固定提交，`.gitmodules` 记录正式远端地址，后续新克隆使用上面的标准命令。

## 新方案的职责划分

| 部分 | 职责 |
| --- | --- |
| `vendor/ghost-maze` + `engine.lock.json` | 固定版本权威规则，保持只读 |
| `src/reference` | 物理参考环境、状态键、求解 CLI 与原分享码编解码入口 |
| `src/search/reference-solver.js` | 直接调用原引擎的完整状态 BFS 对照基线 |
| `src/search/fast-solver.js`、`src/validate/simulator.js` | A* 与经差分验证的紧凑模拟器 |
| `src/search/restrictions.js`、`src/design` | 历史事件监控、反事实分析、底层编辑与证据档案 |
| `src/review` | 隐藏来源的试玩页、本地游戏服务与成对反馈追加日志 |
| `scripts`、`test/reference` | 环境、种子与规则基线检查 |
| `examples/puzzle-units` | 两个已验证单元、证书、设计脚本和示意图 |
| `examples/mechanism-lab` | 互补开关家族、旁路负例、证书与有限编辑实验摘要 |
| `examples/vertical-relay`、`examples/review-batch-01` | 跨层机制家族及第一批已验证试玩包 |
| `data/manifests` | 内容哈希、规则版本与家族元数据 |
| `docs` | 当前方案、评审约定和状态 |
| `src/engine`、旧格式/评审 CLI | 历史材料与对照工具；不作为权威物理规则 |

模型与训练代码将在后续阶段建立。权重、轨迹缓存、运行输出和 Python 虚拟环境已列入忽略规则；当前没有安装 GPU 训练依赖。

## 旧方案保留方式

旧文档和配置已原文归档到 [docs/archive](docs/archive/README.md)，源码、测试和提交历史保留。旧流程可作为 LLM 提案与人工设计的对照基线。

```bash
npm run test:legacy
npm run validate:legacy -- examples/demo-map.json
npm run sharecode:legacy -- examples/demo-map.json --verify
npm run feedback:legacy -- <已归档地图.json> <真实评语> [得分]
```

旧 `validate` 命令明确命名为 `validate:legacy`，底层求解已更新为三态，并对未知返回退出码 3；其阶段筛选和威胁硬门仅作为旧基线，不作为新训练的通用标准。新流程使用 `solve` 或 `solve:fast`，两者都不评价地图是否好玩。

## Codex 迁移

项目指引由 `AGENTS.md` 承担；根目录的 `CLAUDE.md` 已删除，原文保留在历史归档。不改用户全局 Codex 配置。指引文件方式参考 [OpenAI 官方文档](https://learn.chatgpt.com/docs/agent-configuration/agents-md)。

后续在 Codex 中以本仓库为任务工作目录；仅添加到工作区不会让另一个仓库的任务自动切换工作目录。
