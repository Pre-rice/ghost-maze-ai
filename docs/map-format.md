# 当前地图与证书格式入口

地图、游玩、AI与分享复用同级本体接口，不维护第二套物理或协议。

- [MapDefinition](https://github.com/Pre-rice/ghost-maze/blob/main/src/core/mapDefinition.js)与[完整装配校验](https://github.com/Pre-rice/ghost-maze/blob/main/src/core/mapDataUtils.js)。
- [地图码与操作码协议](https://github.com/Pre-rice/ghost-maze/blob/main/docs/share-codes.md)，不写格式版本，无旧码兼容。
- [唯一地图形状](https://github.com/Pre-rice/ghost-maze/blob/main/docs/architecture.md#唯一地图形状)：活动格、墙、鬼、物品与按钮均在layers，全局stairs，无体力。历史顶层结构只能经严格装配接入，冲突拒绝。
- [原种子1](../examples/puzzle-units/unit-01.json)、[原种子2](../examples/puzzle-units/unit-02.json)、[种子清单](../data/manifests/seed-units.json)：原件保持，不能为文档整理重新生成。
- [参考环境与证明范围](reference-contract.md)。

证书、规则锁、家族、搜索预算、质量反馈单独记录，不塞进游戏分享码。合法性、可解、最优与质量是不同结论，设计要求见[现行边界](design-boundaries.md)。旧字段与v3说明见[原格式快照](archive/worklogs/map-format-before-reorganization-20261013.md)，只作历史。
