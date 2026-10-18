# 用户优化图 01：门态准备与按钮回合

> 历史作品说明（2026-10-11）：下文保留原地图、反馈与当时验收证据。旧分享码、体力与独立回放地址已弃用；最新有效试玩和同页回放统一见[AI 地图总目录](https://github.com/Pre-rice/ghost-maze-ai/blob/main/docs/ai-map-catalog.md)。不从旧证据自动推断当前最短性，冲突／非法图在总目录明确列出。

来源：用户于 2026-09-30 提供的分享码。解码后单独保存为 [user-01.json](user-01.json)，没有修改其布局或替换为助手版本。

[在带录制器的新页试玩](http://127.0.0.1:4178/game/?map=Y-bgYGZlSGFlYmZikLGRkZBgYGBkYWJgYmFkcGJmZHDsWqW1Yn-o0Aqt9leLVoFAayhrSP7UkFULQ52_hoIAA5sjgxODIwMA)

用户意图：移除空间绕行和冗余，将关键集中于门态准备、按钮推进一个回合、让鬼贴近跟随。用户认为这个思路比旧图的左上四格掉头更精妙。现已取得并核验[用户真实示范](user-01-demonstration.json)，其动作序列与此前的优化图最优证书一致；旧机器证据中的 `humanRoute: null` 作为生成当时的快照保留。

## 已验证结论

- 14 个活动格，一只鬼，A/B 两个相邻按钮。
- 原引擎 BFS 与 A* 均给出最短 **40 次成功动作，34 次移动**。
- 最短证书按键顺序为 **B、A、A、B、A、B**，共 6 次。
- 分别禁止第三次 A、第三次 B，两个求解器均穷尽无解。因此在当前体力、无伤无复活范围内，至少需要各按三次，而非只有某条最短解恰好按六次。
- 第 28 次动作原地按 B，把鬼从 (4,3) 拉到 (4,2)，随后贴身追随；在此之前要完成 A 的关—开及 B 的门态准备。

原始分享码、来源、完整证书见 [user-01-evidence.json](user-01-evidence.json)，按键下界见 [button-lower-bound.json](button-lower-bound.json)。没有证明它是所有可能布局中的全局最小单元，也没有把求解器动作冒充用户动作。

## 对旧设计解释的修正

旧图最短解走左上四格环路。将左上 B 门改为 EMPTY 后，原来的 37 次动作仍可重放，最短成本不变；把该边改为实墙仍有 56 次动作解。证据见 [top-b-analysis.json](../coupled-singlelayer/top-b-analysis.json)。

因此，“最短路线经过这条边”不等于“它必须是一扇可切换门”。此前关于两组互补门都不可或缺的解释过强，已更正。用户进一步把关注点从最短路线转到按钮的时间作用，这是今后分析生成题时需要保留的策略差异。

原图与用户改图有明确亲缘关系，必须归入同一拆分组，不能一张训练、一张测试后宣称概念泛化。

真实示范已制备为 40 条求解监督样本，并提取、验证了坐标无关的按钮节奏条件。详见 [学习证据](user-01-learning-evidence.json) 与 [数据和机制诊断说明](../../docs/demonstration-learning.md)。本轮 128 次编辑诊断摘要见 [temporal-search-summary.json](temporal-search-summary.json)，这些统计没有被转换为人类质量评分。
