# ghost-maze-ai · 项目协作指引

## 职责与开工入口

本仓只负责 AI 开发、谜题设计、搜索与训练研究、反馈分析、证据及研究资料维护。网站与自主试玩 skill 的开发维护归[游戏仓库](https://github.com/Pre-rice/ghost-maze)，本仓不维护网站界面或发布流程。

每次开工读[当前状态](docs/status.md)，按任务查[文档索引](docs/README.md)；设计前读[方法](docs/methodology.md)和[人读设计小册](https://github.com/Pre-rice/ghost-maze/blob/main/docs/map-design-guide.md)。环境及私人资料读[云端说明](docs/codex-cloud.md)。当前任务和停点只在 status 维护，历史档案不能当现行指令。

目标是具有可推断尤里卡时刻的好谜题；训练是可选路线，不凑相似地图数量，不提前搭训练空壳。以最新用户指令为准，明确暂停时停止设计、生成与训练。

## 分工与交付

- 云端 Codex 推进本仓主线；本地 DeepSeek 不处理本仓研究或训练。需要交付已批准地图成果时遵守目标仓 AGENTS，不把网站工作流复制到本仓。
- 默认 main，开工和推送前 fetch 并核对未提交修改；可快进时快进，有双方提交时正常合并。保留用户工作，禁止 reset、rebase、强推或覆盖；需要隔离分支先说明理由。
- 只提交本任务文件，小步提交并及时推送。不擅自替换确认方案；改判断时保留新旧依据。已授权任务持续到指定停点，不以提交、实验收尾或候选交付代替完成。
- 简体中文沟通、文档与注释，技术名词除外；只向用户报告产品状态、验收和决策所需信息。
- 地图与回放只用 https://ghostmaze.novic.cc/。只有用户明确选入的地图才交付入集，不反复发起上架审批。
- 每次交付及真实改评更新本仓[地图总目录](docs/ai-map-catalog.md)；获准上架时同步人读小册。经验归方法，过程归 archive；不把同一交接日志追加到多个入口。

## 唯一规则与证据

- 同级 `../ghost-maze` 是唯一物理规则源；`src/reference/engine.js` 直接调用，`engine.lock.json` 核验内容。vendor 是历史，不作为运行引擎。
- 真实规则源变化才更新锁并复验相关证书；不得改锁掩盖未解释漂移，不复制物理规则。参考环境、完整状态键与三态结果见[参考约定](docs/reference-contract.md)。
- 历史限制及新增事件依赖进入完整状态键与支配键；禁止原图事件和改图消融是不同证据，不可混用。新增计步、资源或知识依赖时重新论证。
- 区分已找到解、已证明最优、穷尽无解与预算未知；未知不放行，去鬼只作诊断。证书只用真实动作，T 含移动／按钮／楼梯，L 含位移／楼梯。
- 新题执行六句设计卡、普通替代和无条件冗余审查，再做共同引擎证书、全部并列最优、去终点、玻璃改墙、实际入场、编号无关及码往返检查。详见[设计边界](docs/design-boundaries.md)。单元接入整图需复验全局。
- 不把全信息物理状态当迷雾知识状态，不声称指定冷入口适用任意外部局面。必要性、唯一动作、解长与搜索成本不证明趣味。
- 原图、生成时 humanQuality:null、原录制与反馈不覆盖；真实反馈独立保存。不补数值分、用时、完整尝试或提示条件，不给亲缘图转移好评。
- 规划证书、QA、AI 试玩与真人资料分开；亲缘整体拆分，不跨训练和测试。权重、大数据、缓存与 runs 不进普通 Git，新增私人资料另存新包。

## 运行与验收

Node.js 22（已验收 22.21.1）、Python 3，首次 `npm ci`；两个仓库同级。具体环境与资料恢复见云端说明。

```sh
npm run check
npm test
npm run verify:seeds
npm run cloud:check
npm run solve -- examples/puzzle-units/unit-01.json
npm run solve:fast -- examples/puzzle-units/unit-02.json
npm run sharecode -- examples/puzzle-units/unit-01.json --verify
npm run analyze -- examples/shift-handoff-20261015/map.json examples/shift-handoff-20261015/analysis-config.json
```

JavaScript 修改跑 npm test；引擎接入／规则／种子变化加 check 与 verify:seeds，交付统一 cloud:check。纯文档检查链接、职责和事实，不重跑已完成研究。搜索和训练详见[工具文档](docs/README.md)；有限编辑、规划制备只产生机械事实，来源与亲缘组必须明确。

保存私人资料使用新的快照名，原 seed、原录制和旧包保留。旧 LLM 的尺寸／元件限制不约束当前设计；历史导入工具与证据不因旧字段而删除。付费调用与 GPU 不自动启动。
