# 《借影》重合捷径维护版

更新：2026-10-12。用户确认夹击死亡可以保留、非最优走法中的重合可忽略；未来地图和训练素材只要求全部最优解不利用重合。其余八张已上架图保持，维护《借影》并保留控距拉鬼到 A 门下方的设计。

本版只将左列一段空通路补为初始开启的 A 门，沿用现有 A 按钮，无新增按钮、鬼、钥匙或格子。最短恢复 59 动作，原 59 个操作完全保持；按原路线，玩家、两鬼和取物状态每一步均一致。新增门只封住新规则下的重合捷径。

[试玩维护版](https://ghostmaze-ui-preview-20261012.prerice.chatgpt.site/?map=AADAwGHh4eHh4AEdYCF8BeCBlANArwIhKAkFMgrgcuAccAAqgAEgFQTiC5xBOcghBCAAAQIIYAQYgQYY)。正式地图集维护后仍使用《借影》原名称，24 格、两鬼、两钥匙的基本信息不变。

<details>
<summary>参考解法与复核（含答案）</summary>

[原59步动作的维护版回放](https://ghostmaze-ui-preview-20261012.prerice.chatgpt.site/?map=AADAwGHh4eHh4AEdYCF8BeCBlANArwIhKAkFMgrgcuAccAAqgAEgFQTiC5xBOcghBCAAAQIIYAQYgQYY&replay=CH7k9Zggj90mF8CqMlf2oMzILXA)。

第 31 步关闭未来停位上方的 A 门；第 38～44 步引鬼、绕底部控距并切换视线，将原上方鬼从 `(2,5)` 引入 `(1,5)`，此时它上方 A 门关闭。该环节与原参考路线相同。禁止这一侧向安置事件，独立 A*／BFS 均穷尽无伤无复活范围而无解；不将这个结论扩展成人类难度评分。

独立 A* 与 BFS 最短均 59；专门遍历所有并列最优路线，未发现非死亡重合。错误走法仍可夹击死亡，按最新用户标准允许。玻璃数量为零。原地图、旧57步捷径和旧证据保持为历史，未覆盖。

[维护图](map.json)、[证据](evidence.json)、[分享与原动作序列](share.json)。原版来源：[按钮依附修正版](../borrowed-shelter-wallfix-20261009/README.md)。原图的真实好评保留，维护版没有新增独立真人试玩标签，`humanQuality:null`，家族沿用 `dual-loop-relay-v1`。

</details>
