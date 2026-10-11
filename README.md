# ghost-maze-ai · 鬼迷宫 AI 工作区

目标是生成有认知突破、值得反复推敲的谜题。当前有求解、反事实分析、设计搜索、真人路线与反馈工具；尚未启动模型训练或质量模型。

2026-10-11 已完成共同规则升级：游玩、AI 搜索与训练数据制备、同页回放直接调用同级本体规则。体力取消，移动、原地按钮、楼梯都计步。路线保存操作，局面作临时缓存；旧地图码和独立回放入口弃用。

## 当前交付

- [本轮产品结果与验收](../ghost-maze/docs/architecture-delivery-20261011.md)：功能、性能、地图及迁移边界。
- [AI 地图总目录](../ghost-maze/docs/ai-map-catalog.md)：393 份来源去重为 343 张，326 张合法新地图码，298 条当前规则无伤参考路线；含历史候选与对照，不等于正式作品数。
- [门单元《两面》《开路》](examples/door-units-20261011/README.md)：12／11 格，无按钮和玻璃，最短 19／21 动作；已核验，质量待用户试玩。
- 14 份真人保留路线全部迁移并核对物理终局。原 `data/solutions/` 与地图不变，新结果在 `data/generated/recordings-current/`。
- 17 张历史地图存在悬空按钮或数据冲突，目录列原因，不能生成假入口。其中两张跨层图的全局配对楼梯与层内空表冲突，本轮未猜测修复。
- 本体 148 项、AI 126 项测试通过，共同规则内容锁与两个原种子检查通过；Windows 与 Linux 云端迁移验收均通过。两仓 main 已同步 GitHub，线上游戏已更新；本地验收服务 4206 保留。

试玩和回放用同一页：`/game/?map=地图码`、`/game/?map=地图码&replay=操作码`。回放默认暂停与全图，五档速度、跳步、确认加载；直接复制地址栏链接分享。研究留档后台运行，不增加录制框或分享按钮，回放无需 AI 服务。

## 运行

需要现代 Node.js，建议 20 或更高。两个仓库保持同级目录：

```text
Projects/
  ghost-maze/
  ghost-maze-ai/
```

当前主路径不读取 `vendor/ghost-maze` 子模块；其原始内容保留为历史资料。已有 npm 依赖不变，没有引入新的运行库或训练服务。

```text
npm ci
npm run check
npm test
npm run verify:seeds
npm run solve -- examples/puzzle-units/unit-01.json
npm run solve:fast -- examples/puzzle-units/unit-02.json
npm run sharecode -- examples/puzzle-units/unit-01.json --verify
npm run catalog
```

`check` 校验同级本体 core 文件内容锁和两个原种子的内容。规则确实修改后显式运行 `node scripts/lock-engine.mjs`，随后复验相关证书，不能用更新锁掩盖未知漂移。

`solve` 用 BFS，`solve:fast` 用 A* 和紧凑索引；两者的每次状态迁移均是同一个 GameLogic。它们区分已解、穷尽无解与预算内未知。证书在共同引擎执行并验证；日常 AI 图不再整段反复跑浏览器，规则或交互改变时集中验收。

## 数据与代码

| 路径 | 职责 |
| --- | --- |
| `src/reference/engine.js` | 唯一本体规则和分享接口 |
| `engine.lock.json` | 同级本体 core 内容锁 |
| `src/reference/environment.js` | 全信息无伤、无复活环境与完整物理状态键 |
| `src/search/reference-solver.js` | BFS 对照基线 |
| `src/search/fast-solver.js`、`src/validate/simulator.js` | A*、布局和动态门索引；不另实现物理 |
| `src/design`、`src/search/restrictions.js` | 提案、编辑、机制事件及反事实证据 |
| `src/review` | 本地反馈、可选 JSON 录制、旧录制明确原图导入 |
| `src/training` | 示范数据制备，尚未开始训练 |
| `examples/`、`data/`、`runs/` | 作品与证据、真人资料、实验和独立 QA |

`npm run migrate:recordings` 只读原始真人资料，按明确原图关系另存迁移文件；现有迁移目录存在时先核对，不能覆盖原证据。`npm run catalog -- 本体首页地址` 生成总目录和验收记录，默认使用正式站。地图、参考解法和简短用户评述统一列入总目录；每次交付或收到评价、改评都更新，“不错”及以上单独索引。

成对反馈服务仍是本地研究工具。旧六图包包含两张冲突跨层图，当前严格规则下不能直接重建；原包和反馈保留。使用合法地图构建显式试玩包后，服务可保存真实比较。不要为恢复旧包重跑 builder 或擅自改原地图，详见 [反馈工作流](docs/review-workflow.md)。

## 质量与历史

用户关注鬼的引动、停位和安置、各操作之间的相互准备，以及修正合理初始判断后的突破。步数、必要性、最少格数与解长都不能代替趣味判断。地图证书与真实反馈分别保存，不把 QA 轨迹纳为真人数据。

- [当前状态与历史记录](docs/status.md)
- [协作和数据纪律](AGENTS.md)
- [参考环境与三态约定](docs/reference-contract.md)
- [A* 验证与边界](docs/fast-verification.md)
- [录制、分享与历史迁移](docs/solution-recording.md)
- [真实示范与监督数据](docs/demonstration-learning.md)
- [机制搜索](docs/design-search.md)
- [训练方案](docs/ai-training-plan.md)与[研究背景](docs/ai-puzzle-generation-research.md)
- [双鬼正反馈复盘](docs/twin-handoff-review-20261009.md)、[《回环》试玩复盘](docs/shelter-exchange-review-20261010.md)

历史文档里的体力、旧码、旧独立回放与测试数字属于当时规则，不能当作当前入口或新规则证据。旧工具仍可作为对照，实际迁移也调用共同规则；重复 `src/engine` 物理实现已删除。迁移结束后按用户新授权恢复门单元设计，模型训练尚未开始。
## 云端开发

多仓库环境与资料恢复见 [Codex 云端交接](docs/codex-cloud.md)。统一验收使用 `npm run cloud:check`，预览使用 `npm run cloud:serve -- 4206`；两个仓库默认以 `main` 开发。
