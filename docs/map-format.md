# 地图与证书格式入口

地图复用固定游戏子模块中的 `MapDefinition` 与 `DataSerializer`，不维护第二套新协议。

- [游戏地图定义](../vendor/ghost-maze/src/core/mapDefinition.js)
- [分享码 v3 编解码](../vendor/ghost-maze/src/core/dataSerializer.js)
- [游戏协议文档](../vendor/ghost-maze/docs/protocol-v2.md)
- [可执行的第一题数据](../examples/puzzle-units/unit-01.json)
- [可执行的第二题数据](../examples/puzzle-units/unit-02.json)
- [种子版本与内容清单](../data/manifests/seed-units.json)

小单元使用 free 模式与 customStartPos，在 8×8 画布上通过 activeCells 描述较小有效区域。保留 gameMode、initialHealth、initialStamina；单层 layers 可为空。墙位于格子边上，横墙为 (height+1)×width，竖墙为 height×(width+1)。

证书、家族、搜索预算、质量标签放在研究侧伴随记录，不塞进游戏分享码。当前两个单元的证书在 examples/puzzle-units/verification.json；其完整状态穷尽只适用于这些固定案例，不代表通用验证器已完成。

旧格式说明在 [归档](archive/llm-workflow-v1/docs/map-format.md)，仅用于理解旧管线。
