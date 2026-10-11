# 2026-10-08：两张无玻璃单层候选

> 历史作品说明（2026-10-11）：下文保留原地图、反馈与当时验收证据。旧分享码、体力与独立回放地址已弃用；最新有效试玩和同页回放统一见[AI 地图总目录](../../../ghost-maze/docs/ai-map-catalog.md)。不从旧证据自动推断当前最短性，冲突／非法图在总目录明确列出。

- [试玩单元 01](http://127.0.0.1:4178/game/?map=Y-bgYGZlSGFhZGRikOPjY2BgYGBkZmRkZmJYtWrVqqmhXKuQQWtoZWi4Fpy7gImZEQA)：10 个活动格，一只鬼、一把钥匙。
- [试玩单元 02](http://127.0.0.1:4178/game/?map=Y-bgYGZlSGFkZmJm4ODj42FgYGBkZmRgZGZhdFy1atWqlaGqofahKEA01GvVUig7gMmRAQA)：9 个活动格，一只鬼、一个按钮。

游戏页含录制器，通关后自动保存。可以撤回或重试；请先自己玩，再看折叠分析。服务未启动时，在本仓库运行 `npm run review`。

产生过程：固定种子探索小图，按机制关系筛选，再逐项删格、删实体与简化墙体，最后用独立求解、分享码重放和浏览器真实按键通关验证。两份原始提案均为 12 格，分别精简到 10 格、9 格；尚未使用训练好的生成模型。

两题完全不含玻璃。把所有玻璃换成实心墙后，完整地图逐字段不变，因而全部策略不变。玻璃追踪规则仍按原游戏执行，可能的调整继续暂缓。

独立求解、局部精简审计、无终点安全性、分享码往返与浏览器通关均通过；两题录制自动保存正常。全仓 113 项测试通过，另通过引擎检查和旧种子重放。质量待用户实际试玩，机制证据不当作趣味评分。

<details>
<summary>备用分享码</summary>

单元 01：

```text
Y-bgYGZlSGFhZGRikOPjY2BgYGBkZmRkZmJYtWrVqqmhXKuQQWtoZWi4Fpy7gImZEQA
```

单元 02：

```text
Y-bgYGZlSGFkZmJm4ODj42FgYGBkZmRgZGZhdFy1atWqlaGqofahKEA01GvVUig7gMmRAQA
```

</details>

<details>
<summary>内部设计、解法与证明边界（剧透）</summary>

见 [design.md](design.md)。地图与证据：[unit-01.json](unit-01.json)、[unit-01-evidence.json](unit-01-evidence.json)、[unit-02.json](unit-02.json)、[unit-02-evidence.json](unit-02-evidence.json)。浏览器验证见 [browser-qa.json](browser-qa.json)。

原始提案、种子和序号保存在 [source-01.json](source-01.json)、[source-02.json](source-02.json)。过程脚本为 [explore.mjs](explore.mjs)、[inspect.mjs](inspect.mjs)、[build.mjs](build.mjs)。`build.mjs` 使用排他写入，拒绝覆盖现有基线；复建时将三个脚本和两份 source 复制到新的 `examples` 子目录，再运行该副本的 `build.mjs`。

</details>
