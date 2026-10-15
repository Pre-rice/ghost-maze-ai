# 当前状态

更新：2026-10-15。必读[设计方法](methodology.md)与本体[设计小册](https://github.com/Pre-rice/ghost-maze/blob/main/docs/map-design-guide.md)；历史记录不作为现行规则。

- **当前停点：主线阶段已收尾，暂停训练，回到本体优化。** 用户最新要求取代此前持续训练指令；不开下一批训练、生成或实验。研究分支`research/planner-baseline-20261015`，同级本体固定3cebf7f；两个正式main保持恢复版本，未发布新版到正式站。
- 最新多层与方向键修正完成23项专项验收、两仓统一检查，已更新[独立预览](https://ghostmaze-ui-preview-20261012.prerice.chatgpt.site)：底部数字左右加减、新层全满、删顶层、橡皮不删地板、清空不确认、空格返回、方向键拖动与缩放。规则与十三图不变。[验收证据](../data/manifests/four-column-multilayer-browser-20261015.json)。正式发布仍待用户认可。
- 四栏目、URL存档与草稿、跨死亡／重置撤回、手机绘制与渐进加载已完成。十三图原码、排序与最优分类缓存保持。[网页交付](https://github.com/Pre-rice/ghost-maze/blob/preview/site-optimization-20261014/docs/archive/delivery/four-column-workspace-20261015.md)。
- 本地CPU已完成表示修复、程序练习、关系输入、成本监督、长程补样及给定双鬼停位任务。完整游戏精品挑战直接策略仅0–1/13且非最优；最后的给定停位挑战完成5–7/29任务、最优0，必须腾位的15任务均失败。不能替换网站求解器，未新增精品、人类质量标签或地图集内容。[训练入口](planner-training.md)、[阶段结果](archive/research/planner-baseline-20261015.md)、[证据v5](../data/manifests/planning-training-cpu-20261015-v5.json)。
- 确定性去鬼下界降低展开量但未加快求解，默认关闭；鬼对称归并仅当前批次约5%计时改善，也默认关闭且未接入网站。所有最新策略尝试含失败前缀已原生复核，完整模型、资料与失败另存新私人包，旧包及原件保留。
- 当前十三图574参考动作、两个保守亲缘组；旧十五图653行、三个亲缘组及原反馈不覆盖。撤下／否决作品不作质量正例。《腾位》未获评价、不入集。本体是唯一规则源，规则锁未改；最优不利用非致死鬼重合、玻璃仅观察。[设计边界](design-boundaries.md)。

实际缺口仍是长程条件规划、跨结构迁移和自主选择／组合子目标；任务次数、模型拟合和QA不能代替精品质量。暂停后不自行延长研究。旧状态见[快照](archive/worklogs/status-before-planner-training-20261015.md)。
