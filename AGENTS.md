# ghost-maze-ai · Codex 项目指引

## 目标与当前状态

在个人工作站或少量 GPU 条件下，为鬼迷宫生成高质量谜题。效果优先，允许长时间训练与生成；优先死亡循环中的智力体验，用户愿意定期试玩少量候选并做成对比较。

路线：质量多样性搜索 + 学习型地图编辑器 + 完整状态求解 + 人类偏好学习。从小单元的机制作用，推进到操作依赖、跨单元联系和整图体验。

当前已完成 **P0 验证基础、反事实分析、有限编辑实验与首批成对试玩**。三个设计家族已有原引擎证书，3 组 6 图可通过 `npm run review` 试玩并保存比较。接下来收集与分析真实反馈、扩大机制家族，再训练模型。尚未实现模型训练或质量模型，不要把规划写成已完成成果。

**2026-09-30 真实试玩结论**：首批全部太简单、解法显而易见；用户建议优先单层，认为上下楼本身不增加解谜思想。下一步先做 1～2 张有状态相互制约的单层组合题，避免机械扩大家族、加长路线或把明显退化对照交给用户。必要性不等于巧妙，相对胜出不等于达到目标质量。详见 `docs/review-batch-01-findings.md`。

当前待评审的新题在 `examples/coupled-singlelayer`：一张 18 格单层组合题，37 次动作与反事实经独立求解验证，94 项测试通过；仍未得到质量认可。不要把它和旧的三组成对题混写反馈，也不要在用户试玩前展开设计解答。

开始任务先读 `README.md` 与 `docs/status.md`，再按任务读取 `docs/ai-training-plan.md` 和相关代码。调研背景在 `docs/ai-puzzle-generation-research.md`。

## 协作约定

- 交流、文档与代码注释使用简体中文，技术名词除外。
- 用户自己的改动和新增文件不得擅自回退、删除或覆盖；已有明确授权的任务按其范围执行。
- 不擅自替换用户指定方案。遇到影响目标、范围或产品行为的不确定性先沟通；已确认的方向不重复请求许可。
- 用最少的代码完成当前阶段，不提前搭建空壳训练系统或引入大量依赖。
- 初始化不等于开始训练。训练预算、付费调用、长期运行按用户实际任务执行；不要自动启动。

## 规则与数据的权威来源

- `vendor/ghost-maze` 是游戏仓库子模块，提交由 `engine.lock.json` 固定。通过 `src/reference/engine.js` 调用原始 `GameLogic`、`MapDefinition` 和 `DataSerializer`。
- 新物理参考接口为 `src/reference/environment.js`，求解基线为 `src/search/reference-solver.js`。其输入范围和证明边界见 `docs/reference-contract.md`；不把全信息物理状态键用于迷雾知识状态。
- 不直接修改子模块或同级游戏工作区。规则升级是显式任务，必须更新锁定版本并重新验证证书。
- `src/engine` 是历史副本，不作为权威物理规则源。`src/validate/simulator.js` 已对齐当前规则，配合 `src/search/fast-solver.js` 使用；修改后必须跑原引擎逐状态差分和证书重放，详见 `docs/fast-verification.md`。
- `src/validate/solver.js` 是三态 A* 的旧 API 兼容包装。未知的 `solvable` 为 null；`withGhosts:false` 仅为去鬼诊断，不能当作原图无伤证书。旧阶段格式和威胁门只保留在 legacy 工具中。
- `docs/archive/llm-workflow-v1` 是历史材料，不是当前阶段限制。旧的仅 10×10、禁止字母门、被鬼看见至少一次等约束不作为新方案的通用硬条件。
- 当前已验证种子见 `examples/puzzle-units`；两题属于同一诱导环路家族，不能分到训练集与测试集两边。
- 新互补开关及旁路对照见 `examples/mechanism-lab`；父图与编辑后代继承同一家族。`src/design` 输出机制证据，不是趣味分数；说明见 `docs/design-search.md`。
- `restrictions` 的历史进度必须同时进入完整状态键和资源支配键。现有事件不依赖体力、计步或知识；若增加此类事件，必须重新审查支配剪枝。原图禁止事件与修改地图的对照不可混为一谈。

## 实验纪律

- 区分找到解、证明最优、证明无解和预算内未知。超时不能标为无解；搜索难度不直接等于好玩。
- 证书仅允许真实玩家动作；按钮通过站位和方向触发，禁止远程按按钮、任意位移或修改状态。
- `T` 为含按钮的成功动作数，`L` 为移动和上下楼次数。体力约束、鬼的数组顺序、动态门与物品状态都要正确处理。
- 验证后的分享码必须用参考引擎重放。单元接入整图后还要重新验证全局行为。
- 人工偏好必须来自真实反馈；不可把设计意图、模型评分或对话中的一般肯定伪造成成对标签。
- 真实反馈保存在 `data/feedback/<packetId>.jsonl`；浏览器/单元测试只写独立临时路径或 `runs/`。不得把测试标签混入训练。保留改评历史，当前训练比较仅取每组最新有效选择，无法判断不是平局。见 `docs/review-workflow.md`。
- 记录游戏提交、数据家族、种子、搜索预算、模型和评价器版本。权重、大数据、缓存和运行输出不进入普通 Git 提交。

## 常用命令

```text
git submodule update --init --recursive
npm ci
npm run check
npm test
npm run verify:seeds
npm run solve -- examples/puzzle-units/unit-01.json
npm run solve:fast -- examples/puzzle-units/unit-02.json
npm run sharecode -- examples/puzzle-units/unit-01.json --verify
```

`npm test` 同时运行参考/快实现对照与原有工具回归。原有套件可用 `npm run test:legacy`。旧地图验证器为 `npm run validate:legacy -- <map.json>`，其额外筛选政策不能直接作为新训练标签。

修改 JavaScript 后跑 `npm test`；修改参考引擎连接、种子或证书后再跑 `npm run check` 与 `npm run verify:seeds`。纯文档修改检查链接和一致性即可。
