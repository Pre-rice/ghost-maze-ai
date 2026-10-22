# 《丈量》· 新候选

27格、包络6×6、三鬼，A/B两组门、一把钥匙。开局没有追逐；取钥匙后到达右上终点。最优34步，唯一含停顿鬼轨迹。生成时尚无真人评价；用户2026-10-22实评“没意思”“卡鬼装置太刻意”“没什么让人惊讶的点”，不入地图集、不计新意进展。[实际评述与判断修正](../../data/manifests/ranged-bait-station-review-20261022.json)。原图及原证据保持，未训练或自动调用试玩技能。

[无剧透试玩](https://ghostmaze.novic.cc/?map=AADA-fHx8fGAAAEmYEseIAmBAAAg6QKqJKHIDgAA5UKAAABc4zFwoVEIIUISAAAABBBDDAQA)

<details>
<summary>设计思想、反例与参考（含答案）</summary>

先把中央鬼暂留在下方，玩家才能抵达上控制；但这个停位又妨碍远距离引动钥匙鬼。不是再用它争位挡另一只鬼，而是把它送回原位，重新保护以后要用的诱导站位。上端B既把终点守卫停在合适位置，也给中央鬼多一次推进；随后再关A，才能安全离开上控制。此为设计预期，没有宣称玩家实际顿悟或已刷新最高评价。

原图分别允许与禁止非最优重合核对：任一鬼始终不动、中央鬼从未回到初位、首次停在下方后不再移动，全部无伤无复活均穷尽无解。钥匙鬼可以最后独立引动，不能据此声称全解三方同步交错；严格无分段解也不是趣味证明。唯一参考没有争位事件。

先把中央鬼留好，再直接取钥匙，能在13步活着拾到钥匙，但没有任何无伤续解。先在上端按B仍可恢复，总计38步；不把可补救的选择说成死局。这些是真实引擎中的设计者反例，不是玩家实际尝试。

[34步参考回放](https://ghostmaze.novic.cc/?map=AADA-fHx8fGAAAEmYEseIAmBAAAg6QKqJKHIDgAA5UKAAABc4zFwoVEIIUISAAAABBBDDAQA&replay=EK7quyzYAwhl0g_cYPA)

</details>

全部唯一最优无伤、无复活、无非死亡重合，去终点安全；指定外部(0,6)向上一步入场，初态和整条最优内部物理状态保持。3748个可达局面、六种排列及变编号的111120次后继对照含死亡动作一致；共同原生与快速环境、地图与操作码往返通过。无玻璃或楼梯。

曾剪掉未走的观察格，导致钥匙守卫不再参与；该改稿已撤回。当前删中转列、移近出生，组合去掉多余门属性，保留必要的远距观察空间。最终普通门也固化为墙，减少元件；不是靠多走几圈凑解长。

[独立构造](build.mjs)、[完整证据](evidence.json)、[原图查询](analyze.mjs)与[来源](source.json)保留。`node examples/ranged-bait-station-20261021/verify.mjs`复验；研究过程与失败稿见[清单](../../data/manifests/ranged-controls-and-release-counterexamples-20261021.json)。
