# 当前状态

更新：2026-10-15。必读[设计方法](methodology.md)与本体[设计小册](https://github.com/Pre-rice/ghost-maze/blob/main/docs/map-design-guide.md)；历史记录不作为现行规则。

- 用户已明确恢复主线训练，网页验收与训练研究分开。研究分支`research/planner-baseline-20261015`，同级本体固定3cebf7f；正式两个main保持恢复版本，未发布新版到正式站。付费／GPU不自动启动。
- 最新多层与方向键修正完成23项专项验收、两仓统一检查，已更新[独立预览](https://ghostmaze-ui-preview-20261012.prerice.chatgpt.site)：底部数字左右加减、新层全满、删顶层、橡皮不删地板、清空不确认、空格返回、方向键拖动与缩放。规则与十三图不变。[验收证据](../data/manifests/four-column-multilayer-browser-20261015.json)。
- 四栏目共用首页、独立回放、帮助弹窗、URL存档与草稿、跨死亡／重置撤回、手机绘制与渐进加载已完成；前三轮预览验收、当前十三图码与全部最优分类缓存均保持。[网页交付](https://github.com/Pre-rice/ghost-maze/blob/preview/site-optimization-20261014/docs/archive/delivery/four-column-workspace-20261015.md)。
- 主线已重核当前十三图：574参考动作、两个保守亲缘组；新穷尽图11190局面、18982候选边，首轮CPU训练已真实完成。模型未优于手工距离基线，闭环0/13通关；不进入网站。[训练入口与约束](planner-training.md)、[结果与失败定位](archive/research/planner-baseline-20261015.md)。
- 旧十五图653行、三个保守亲缘组及原录制／反馈保持，不被新十三图库覆盖。被否决／撤下《相让》《隔岸》《楼间》等未变成质量正例；未获真人评价《腾位》仍未入集。
- 当前十三图按用户授权完成精简与轮廓更新，边界门已清理；本体是唯一规则源，楼梯按相邻通道，最优禁止非致死重合，玻璃仅观察。旧兼容与107615后继证据只声明其原验证范围。[地图维护](archive/reviews/map-maintenance-review-20261014.md)、[设计硬边界](design-boundaries.md)。

## 继续推进

先修训练输入压缩导致的标签冲突，用同图拟合诊断和整亲缘留出比较区分表示与迁移瓶颈。只把实际能力增益算作进展，不把步骤数、模型拟合或机械必要性当作精品质量。原始数据、完整失败结果、模型与协议以新私人包保存，Git保存可复现实现及证据摘要。

本轮更新前的细项与历史停点见[原状态快照](archive/worklogs/status-before-planner-training-20261015.md)。后续仍自主持续工作，用户返回后再审批网页与主线成果；不请求审批，不把候选或提交当停点。
