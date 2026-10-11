# 2026-10-08：双开关组合候选

> 历史作品说明（2026-10-11）：下文保留原地图、反馈与当时验收证据。旧分享码、体力与独立回放地址已弃用；最新有效试玩和同页回放统一见[AI 地图总目录](../../../ghost-maze/docs/ai-map-catalog.md)。不从旧证据自动推断当前最短性，冲突／非法图在总目录明确列出。

[开始试玩](http://127.0.0.1:4178/game/?map=Y-bgYGZlSGFlYmFlYLOTkJFhYGBkYWJgYmZidmRiZXJatWrVqk2rVv5a1bXibygMeK1aBKJ-fw11BfMZOJwYHBkcGZ0YAQ)

单层，15 个活动格，一只鬼，A/B 两组开关。不含玻璃，所有玻璃换实墙后完整地图恒等，因而全部策略不变。保持默认体力 100；游戏规则未改。通关后自动保存路线，支持撤回和重试。服务未运行时，在本仓库执行 `npm run review`。

产生过程：参考第一张组合题的操作依赖，扩大到双开关提案。固定种子进行了 10 万次提案循环，留下一个待审候选；这不是 10 万张有效地图。逐项检查替代解、门属性和开关顺序，删除只增加绕路的钥匙、数字门、两扇字母门和五格，从 20 格精简到 15 格。仍是过程式搜索，尚未使用训练好的模型。

这次重点检查两组操作能否相互准备、是否仍需回来重新配置；不能只用步数和按钮次数判断巧妙。原引擎 BFS、A*、分享码逐步重放、无终点安全性及浏览器真实按键通关均通过，自动录制已核验。全仓 116 项测试通过，另通过引擎检查和旧种子重放。是否达到目标质量，仍待用户试玩。

上一批实际筛选条件和缺口见 [机制筛选说明](../../docs/mechanism-selection-20261008.md)，后半部分的具体证据含新题剧透。

本题已收到真实评价：“这张也还可以。算是个像样的解谜，但是也称不上精妙。随便试试就过了”。保留为像样但未达到目标质量的样本，不填数值评分或成对偏好；[原话记录](../../data/feedback/interlocked-observation-20261008.json)。具体操作依赖成立仍不足以要求提前推理，下一轮增加对局部试探与前瞻准备的审查。

<details>
<summary>备用分享码</summary>

```text
Y-bgYGZlSGFlYmFlYLOTkJFhYGBkYWJgYmZidmRiZXJatWrVqk2rVv5a1bXibygMeK1aBKJ-fw11BfMZOJwYHBkcGZ0YAQ
```

</details>

<details>
<summary>内部分析、解法与证明边界（剧透）</summary>

见 [design.md](design.md)。地图、证据和浏览器验证分别见 [map.json](map.json)、[evidence.json](evidence.json)、[browser-qa.json](browser-qa.json)。证书对应的是求解器路线，不是用户实际路线。

本次真实录制的分段核验见 [feedback-analysis.json](feedback-analysis.json)，完整说明见 [反馈复盘](../../docs/interlocked-review-20261008.md)。不修改原始录制或旧机械证据。

[source.json](source.json) 保存原始候选、种子、提案序号与搜索汇总；[discover.mjs](discover.mjs)、[evaluate.mjs](evaluate.mjs)、[build.mjs](build.mjs) 保存提案、保留条件和构建验证。`build.mjs` 使用排他写入；复建时把三个脚本与 source 复制到新的 `examples` 子目录，再运行该副本，不覆盖当前证据。局部精简仅针对声明的单次编辑集合，未证明全局最小。

</details>
