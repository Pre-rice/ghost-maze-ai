# 互补开关：先取钥匙，再回来换路

> 历史作品说明（2026-10-11）：下文保留原地图、反馈与当时验收证据。旧分享码、体力与独立回放地址已弃用；最新有效试玩和同页回放统一见[AI 地图总目录](https://github.com/Pre-rice/ghost-maze-ai/blob/main/docs/ai-map-catalog.md)。不从旧证据自动推断当前最短性，冲突／非法图在总目录明确列出。

这组题用于验证评价器能否区分真正的操作依赖与可绕过的机关。尚未经过你的试玩评分，不作为已确认好玩的样本。

## 试玩

在原游戏编辑器中导入分享码即可游玩；地图与分享码证书见 [evidence.json](evidence.json)。

- [complementary-switch.json](complementary-switch.json)：原题，8 个活动格，无鬼；重点是同字母门的互补切换。
- [bypass-control.json](bypass-control.json)：对照，只删除原题出口前的数字锁门。

complementary-switch 分享码：

```text
Y-bgYGZlSGFlYmZhYFCy42BgYGBgZGRiZGZhclwFBlNLQ1ahgfn7teBsVkZHBkdGAA
```

bypass-control 分享码：

```text
Y-bgYGZlSGFlYmZhYFCy42BgYGBgZGRiZGZhclwFBlO1loaigpC_P-HsABZHBkdGAA
```

结构示意（空白为非活动区，横竖相邻的点沿走廊相通，具体门位见说明）：

```text
 K   E
 .....
   S
```

S 处向左按 A。中央岔路左侧 A 门初始关闭，右侧 A 门初始开启；每次按 A，两扇门同时翻转。左端支路有钥匙，右端终点前有需 1 把钥匙的数字门。钥匙不因开锁扣除，规则与原游戏一致。

<details>
<summary>解法与验证结果（剧透）</summary>

原题：按 A → 上、左、左、上拿钥匙 → 下、右、右、下回开关 → 再按 A → 上、右、右、上抵达终点。

动作证书 `LULLUDRRDLURRU`，最短 14 次成功动作、12 次移动。禁止按 A、禁止第二次按 A、或禁止“拾取钥匙之后再按 A”，均已穷尽证明此范围内无解。

对照图：`URRU`，4 步直接通关。按键、取钥匙与返回切换均可绕过。此差异说明整题的操作依赖来自钥匙门与互补门的组合，仅摆放两个开关门并不够。

</details>

家族统一为 `complementary-switch-v1`，人工偏好均为空。固定种子自由编辑的 96 次实验摘要在 [search-summary.json](search-summary.json)；它保存机制变化而不冒称发现了更好玩的谜题。

复现与语义边界见 [设计搜索说明](../../docs/design-search.md)。旧的两个诱鬼单元保持原样，见 [puzzle-units](../puzzle-units/README.md)。
