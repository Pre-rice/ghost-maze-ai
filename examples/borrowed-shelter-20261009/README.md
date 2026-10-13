# 新单层候选（2026-10-09）

> 历史作品说明（2026-10-11）：下文保留原地图、反馈与当时验收证据。旧分享码、体力与独立回放地址已弃用；最新有效试玩和同页回放统一见[AI 地图总目录](https://github.com/Pre-rice/ghost-maze/blob/main/docs/ai-map-catalog.md)。不从旧证据自动推断当前最短性，冲突／非法图在总目录明确列出。

**旧版已撤回**：B 按钮悬空，未通过墙面依附合法性。请使用[修正版入口](../borrowed-shelter-wallfix-20261009/README.md)。下面的地图、验证和精简说明保留为原生成档案，不代表合法性验收，也不直接适用于修正版。

[开始试玩](http://127.0.0.1:4188/game/?map=FcGxDYNAEATA3ds3IkBygFzQHznRn2jAdZBRCsmV4lKcOLZkJMOM-l43PEV23XC_wAwqpkIUGiqLuaQK2ZS5x5zLe_-239EecWp5WmP5vHI9wnOLCIxW6axwOCc4nM4_)

24 个活动格、单层、两只鬼、两把钥匙、四个按钮，默认体力 100，无玻璃和单向门。沿用游戏已有规则。可按需要打开已有的调试视野观察全图；解法先不展开。

本次先从上一题做有限结构提案和固定种子编辑探索，再选一个内部母图手工修订。筛选检查操作之间的前置准备和相互制约，排除能跳过这些关系的胜利路线；精简删除三处门属性。原引擎、分享码和真实浏览器无伤通关均已核验，难度与巧妙程度等待试玩反馈。

通关会自动保存当前保留分支。下一步结合你的卡点与路线复盘，尤其看突破是否需要思考、是否仍能顺着元素提示试出来。

重启本次试玩服务：

```text
node examples/borrowed-shelter-20261009/serve.mjs
```

<details>
<summary>剧透：解法、筛选过程和证据边界</summary>

[具体解法与逐格作用](design.md)；[按机制关系筛选的详细说明](../../docs/archive/selection/borrowed-shelter-selection-20261009.md)。

最短 59 次成功动作，其中 53 次移动、6 次按钮，剩余体力 47；按钮词为 `CABCAB`。原引擎 BFS 与快 A* 一致。六项原图事件限制分别穷尽无解，只证明对应事件或有序子序列不可绕过，不证明完整顺序唯一，也不固定所有解的鬼身份分工。

- [原图与真实来源](source.json)、[最终地图](map.json)、[生成时证据](evidence.json)、[清单](manifest.json)。
- [直觉计划与逐格审查](strategy-review.json)、[浏览器验收](browser-qa.json)、[正式分享码](share.json)。
- [机制保留条件](evaluate.mjs)、[本次构建脚本](build.mjs)、[计划审查脚本](review.mjs)、[浏览器准备脚本](prepare-browser-qa.mjs)。

构建脚本是本次运行档案，读取忽略目录中的已完成精简输出，不是完整探索过程的独立复现入口；已有产物使用排他写入，不能直接重跑覆盖。日后复核可直接读取已保存的最终地图、条件与证书。未使用训练模型；仍属于 `dual-loop-relay-v1` 拆分组，`humanQuality:null`，不当作独立泛化结果。

初态部分目标被迷雾遮挡，未证明迷雾知识策略。正式分享码 128 字符，参考码 130，压缩前 106 字节完全一致；不声称分享码全局最短或公网秒加载。浏览器测试只向 `runs/borrowed-shelter-20261009/qa-recordings` 写录制。

</details>
