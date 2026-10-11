# 《回位》

> 历史作品说明（2026-10-11）：下文保留原地图、反馈与当时验收证据。旧分享码、体力与独立回放地址已弃用；最新有效试玩和同页回放统一见[AI 地图总目录](../../../ghost-maze/docs/ai-map-catalog.md)。不从旧证据自动推断当前最短性，冲突／非法图在总目录明确列出。

[试玩入口](http://127.0.0.1:4212/game/?map=Y-bgYGZlSGFgYmJl4OPn4-NjYGBiZGRiYmBhYmV0ZGZhdmJiZHBkZGRwYggRf6B_v-EP8weuBgYGhv11TX9_f-Fy6BB_AuSJOTE6MjoyODE6McBoEAsA)

[参考解法回放（剧透，自动播放、显示全图）](http://127.0.0.1:4213/replay.html?id=99d1ca99-1ebf-495d-8ac3-7f6e08900ab2&autoplay=1&vision=full)

这次用三列矩形组织空间，保留两只鬼和两组机关。先手工提出停位与操作站之间的冲突，查掉普通追逐的替代解，再从 6428 个不同的门配置中筛出候选，将六个按钮站减为四个；最后删去一面内部实墙。没有训练模型。原引擎、分享码和浏览器逐状态核验均通过，实际难度与巧妙程度等试玩反馈。

单层，16 个活动格，4 个按钮，11 扇字母门，无钥匙、玻璃和单向门，默认体力 100。正式分享码 116 字符。分享码压缩前与参考码的 94 字节位流一致，替换全部玻璃是完整地图恒等。

正式服务保存真人保留分支，参考回放的测试证书只在独立 QA 目录。原《借位》页面保留。服务已运行；重启时在 AI 仓库执行 `node examples/return-to-source-20261010/serve.mjs`，回放服务另用 `--qa`。

<details>
<summary>完整机制筛选与证书（剧透）</summary>

见 [详细机制筛选](../../docs/return-to-source-selection-20261010.md)、[证据](evidence.json)和[浏览器验收](browser-qa.json)。最短证书 35 次成功动作、25 次移动、10 次按钮操作；A* 和独立原引擎 BFS 均已证明。门与按钮的数量本身不代表质量。

</details>

下一步继续审查更少机关下的鬼位相互制约，用户解完后再合并具体反馈。
