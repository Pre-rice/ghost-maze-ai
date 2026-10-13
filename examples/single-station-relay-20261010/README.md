# 借位

> 历史作品说明（2026-10-11）：下文保留原地图、反馈与当时验收证据。旧分享码、体力与独立回放地址已弃用；最新有效试玩和同页回放统一见[AI 地图总目录](https://github.com/Pre-rice/ghost-maze/blob/main/docs/ai-map-catalog.md)。不从旧证据自动推断当前最短性，冲突／非法图在总目录明确列出。

十三个活动格，两只鬼，两个按钮；单层、体力 100，无玻璃、钥匙、数字门或单向门。两个按钮分别依附右墙与下墙。

[开始试玩](http://127.0.0.1:4210/game/?map=DcFBDYAwEEXBt91P0gYkNGhhqwEcIA1hHPDQhHCgM56zT5xmEmutFUhmLpLkIVnj0If3e2eY-1O2q7wMS7MgaASNHw)

[参考解法回放——剧透，自动播放、显示全图](http://127.0.0.1:4211/replay.html?id=3369af8b-868d-4c47-bac2-75ef28050c76&autoplay=1&vision=full)

产生过程：先手工搭建共用操作格，发现初版只是两段独立引鬼，没有采用。随后围绕操作格、两处安置区和互补门态生成有限变体；本轮检查 20243 个提案，十个通过机械粗筛，人工审查后选中 10743。再把一扇字母门简化为实墙，保持首次安置影响后续撤离的关系。最终地图已通过原引擎、分享码和浏览器无伤验收，实际质量等待试玩。

[按机制关系筛选的详细说明——剧透](../../docs/archive/selection/single-station-relay-selection-20261010.md)

<details><summary>验收数据与复现文件</summary>

最短 31 次成功动作、28 次移动、3 次按钮，剩余体力 72。分享码 90 字符。原引擎 BFS 与快 A* 最短一致，五项原图事件限制均穷尽无解；这不证明人类难度或唯一完整操作顺序。没有证明迷雾知识策略，可使用游戏已有的调试视野观察整图。

源图在 [source.json](source.json)，精简记录在 [minimized.json](minimized.json)，最终图在 [map.json](map.json)，原引擎证据在 [evidence.json](evidence.json)。[逐门对照](wall-ablation.json)、[浏览器验收](browser-qa.json)和[回放验收](replay-qa.json)独立保存。旧的 29 动作精简版因末段追逐淘汰，仅保留在 runs 的内部归档。

固定规则 `9825376f2cf93f844146c83214f680425c22498b`，家族拆分组仍为 `dual-loop-relay-v1`，生成时 `humanQuality:null`，未启动训练。

`node examples/single-station-relay-20261010/serve.mjs` 提供试玩，追加 `--qa` 提供独立回放服务。已生成的文件用排他方式保存，不重跑 build 覆盖产物。

</details>
