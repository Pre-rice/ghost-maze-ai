# 跨层接力单元

> 历史作品说明（2026-10-11）：下文保留原地图、反馈与当时验收证据。旧分享码、体力与独立回放地址已弃用；最新有效试玩和同页回放统一见[AI 地图总目录](https://github.com/Pre-rice/ghost-maze/blob/main/docs/ai-map-catalog.md)。不从旧证据自动推断当前最短性，冲突／非法图在总目录明确列出。

新家族 `vertical-relay-v1`。这是机制覆盖与评审流程的受控样本，尚未经过真实偏好评审。

建议先通过 [成对试玩页](../review-batch-01/README.md) 游玩，下面的解释包含剧透。

<details>
<summary>设计说明与证据</summary>

两层各有 4 个活动格。下层有出生点、楼梯、字母门 A、需 1 把钥匙的数字门及终点；上层有相互分开的钥匙支路和按钮支路。按上层的 A 会打开下层 A 门，钥匙全局共享，必须回下层通关。

- [remote-switch.json](remote-switch.json)：最短 12 次动作、11 次移动。按 A、拾取钥匙、到上层后回下层均必要，BFS 与 A* 分别穷尽验证。
- [local-key-control.json](local-key-control.json)：仅将下层 A 门替换为普通门，最短 9 次动作。依旧必须上楼取钥匙并回来，但按钮支路可以绕过。文件名为内部编号，钥匙仍在上层。

原题最短动作证书为 `R, STAIR, R, R, L, L, U, L, D, STAIR, R, R`；对照为 `R, STAIR, R, R, L, L, STAIR, R, R`。钥匙与按按钮可有不同先后顺序，不把某条最短解的顺序冒称唯一顺序。

两题同属一个家族，不能分别作为训练集和测试集样本。逐项反事实、规则提交、分享码及父子变更在 [evidence.json](evidence.json)。

</details>

重建命令：`npm run rebuild:vertical`。此命令重写此目录中由脚本生成的地图和证据。
