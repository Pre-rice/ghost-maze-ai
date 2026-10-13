# ghost-maze-ai · 谜题设计与验证工作区

最终目标是产生极棒的地图，让玩家发现可推断而不明显的巧妙解法。当前以提出点子、程序验证、精简结构和真实反馈推进；训练AI是可选路线，尚未启动。

## 常用入口

- [当前状态](docs/status.md)：只保留有效结果与下一步停点。
- [持续设计方法](docs/methodology.md)：尤里卡时刻、正反经验、设计卡与反馈循环，每次设计前读。
- [地图集设计小册](https://github.com/Pre-rice/ghost-maze/blob/main/docs/map-design-guide.md)：十一张已上架图的基本信息、设计思想、关键发现和简评；含答案。
- [文档索引](docs/README.md)：工程、资料与历史按任务查阅。

《再借》获用户“妙、非常棒、很有新意”的明确肯定并加入地图集；十一张按首次交付顺序。十四图634条最优动作状态、两个保守亲缘组已制备，仍不等于634件谜题或独立质量样本。详见[状态](docs/status.md)及[清单v7](data/manifests/planning-library-20261013-v7.json)。

## 运行

两个仓库同级，命名 ghost-maze 与 ghost-maze-ai。Node.js 22.21.1、Python3；AI仓 npm ci。本体是唯一规则源，vendor为历史，不作为运行引擎。

```text
npm run cloud:check
npm run cloud:serve -- 4206
npm run solve -- examples/puzzle-units/unit-01.json
npm run solve:fast -- examples/puzzle-units/unit-02.json
npm run sharecode -- examples/puzzle-units/unit-01.json --verify
```

cloud:check统一检查两仓测试、规则内容锁、原种子与HTTP／代理入口，不写真人反馈。cloud:serve的本地入口为 /game/；真正的云端预览地址由当前环境提供。

check、verify:seeds分别核对引擎与原种子；真实core修改才更新锁，不用改锁掩盖漂移。求解区分已解、穷尽无解、预算未知，必要性与搜索成本不是趣味分。prepare:library只制备规划事实，目标目录必须新建，来源与亲缘组明确。

## 保存和交付

默认main，完成及时提交推送；试玩／参考用正式站，Sites只预览网站改动，不检查Vercel或正式站部署。新图只有用户明确选择才上架；反馈与真人记录、求解证书、QA互相区分，原件不覆盖。

每次交付或反馈更新本体[总目录](https://github.com/Pre-rice/ghost-maze/blob/main/docs/ai-map-catalog.md)；上架图同步小册，经验只提炼至方法文档，过程进archive。源代码通过Git保存；完整真人资料、未跟踪反馈和runs通过[私人资料包](docs/codex-cloud.md)另存新快照。

当前按用户要求完成中途重整，报告交付后暂停，不自动开始新图或训练。此前训练计划与旧交接保留为[档案](docs/archive/README.md)，不是必须执行的路线。
