# 当前状态

更新：2026-10-26。目标是好谜题与可推断的尤里卡时刻；训练只是可选手段，本阶段不启动训练。

## 当前任务与持续范围

用户开始系统性审查当前36关，现阶段暂停新图、改图和关序调整，冻结当前地图与顺序。交付逐关页面的预加载及一个人读[设计审查说明](../examples/discovery-course-20261023/review-guide.md)：每关写明来源、具体改动、设计意图、关序作用和待验证问题。原作好评不转移给课程改作或关序，机械证据不代替真人反馈。

预加载采用同一游戏实例准备相邻两图，切关不重载整个游戏；原逐关网址使用本体预览副本提供预加载，不要求试玩者另换入口；正式站链接仍指向原站。本体嵌入支持先在公开Site验收，未获得本轮正式发布授权前不推送本体main。当前本体交互改动受其AGENTS的“先验收后上线”约束。审查材料及研究归本仓，网站实现归本体与Site源码，不复制物理规则。

仅死亡循环，不涉及正式地图集、训练、付费／GPU或自动试玩skill。只有用户明确调用时才用试玩skill。此前《回流》《换庭》《进退》的负反馈与冻结保持，不恢复旧近亲递补。最新课程整体反馈见[原话记录](../examples/discovery-course-20261023/reviews/teaching-feedback-20261023.json)。

## 公开试玩与当前取舍

[鬼迷宫 · 初见](https://ghostmaze-discovery-path.prerice.chatgpt.site)公开给所有人，当前36关：16张课程专用图、20张既有图的复用或课程变式。Site第88版原生部署成功，来源与版本见[发布记录](../examples/discovery-course-20261023/site-publication.json)。不是原31张机制演示串重新上架。

[逐关设计审查说明](../examples/discovery-course-20261023/review-guide.md)是本轮人读入口，[课程目录](../examples/discovery-course-20261023/README.md)保留证据索引。`course-order.json`是关序唯一来源，目录ID不是关数。Site的“设计说明 · 含剧透”跳到当前关，正常试玩不显示意图或解法，刷新清单保留当前局面。项目`appgprj_6adb4b311474819180db83f0509d84e1`，Site独立源码在`/workspace/sites/ghostmaze-discovery-path`。

- 前五关只用墙、鬼和普通门；首A已改完整往返，并由单A双鬼45承接，再进入《错位》的A/B。钥匙与1在第11关《内外》的完整取物任务中引入。原演示小关不恢复。
- 第14关53首次使用0，先准备远端守卫再取物；可先探门退回，不是碰门即错。暂驻与逆渡继续同0门，再借再主动招回旧鬼；第19关49可余一把钥匙过2门。两钥匙保护交接48随后使用资源不消耗的关系。[首次0](../examples/discovery-course-20261023/reviews/before-key-entry-20261025.md) · [数量选择](../examples/discovery-course-20261023/reviews/key-choice-20261025.md)。
- 第16关逆渡52现v02为22格阶梯轮廓，收去左上三格，全部24条原22步最优及旧24步普通方案共552帧保持。原25格与证据完整留档，不声称所有错误探索等价。[精简及范围](../examples/discovery-course-20261023/reviews/zero-economy-20261025.md)。
- 方向主题先用11格控制室50，再用双鬼46与控制可达性51。46有同最优而无实际互挡的方案，不强称借鬼必学；51中A影响内B是否可达，取物前后安排不同。原43及正式归途保持。[控制室](../examples/discovery-course-20261023/reviews/control-circuit-20261025.md) · [控制可达性](../examples/discovery-course-20261023/reviews/controller-access-20261025.md)。
- 后段侧入47聚焦接近方向，同行仍允许52步晚召回，不把最优提前时机当必学。布阵四种减鬼稿未采用，继续原四鬼，再经调度、留隙、门庭区分整体调度、撤去保护与回合相位。[普通通关前提](../examples/discovery-course-20261023/reviews/ordinary-clear-and-optimal-timing-20261024.md) · [后段取舍](../examples/discovery-course-20261023/reviews/late-course-scope-20261025.md)。
- 第17关55复用未评价《悬置》，逆渡→悬置→再借：先保留一份未完成安置，才能处理另一鬼。原15格22步保持，旧规则证据不覆盖，四项事件、两种提前处理与真正外侧入场在现行规则另验；不称高级新机制突破。[课程角色及证据](../examples/discovery-course-20261023/reviews/suspended-course-20261025.md)。
- 第24关56复用未评价《借道》，回望→借道→借影：把未来开路应用到不可恢复的0与双取物；24格含两处封闭美化格，44步六条原始最优为两种鬼轨迹。旧参考映射保持，八项事件、错误计划与真正入场另验，不把机械事实当趣味。[取舍与当前证据](../examples/discovery-course-20261023/reviews/borrowed-route-course-20261026.md)。
- 第10关57为25格单A三鬼完整任务，接在接力与首次钥匙之间。先准备队列及离开相位，再借普通门进入；门外追者会封住回头。少一次A的实际安全前缀已无续解，仍无真人评价。[设计与取舍](../examples/discovery-course-20261023/reviews/inner-queue-20261026.md)。
- 第35关54为25格双层完整取物题，35步两种轨迹：近端搬运堵住最后入口，从北端准备才保留返回。定位为停位规划的首次跨层应用，不称高阶楼梯独有突破，原楼间仍撤下。[设计与当前证据](../examples/discovery-course-20261023/reviews/overpass-20261025.md)。
- 第36关58用15格同室两用承接54：第一次带追者跟下楼，第二次才留住另一只，结合已有单向口和跨层A。26步两种鬼轨迹，先永久停车的8步仍可再26步恢复；固定原停位才无续解，不声称楼梯独有突破。[当前取舍](../examples/discovery-course-20261023/reviews/shared-slot-20261026.md)。

此前的楼梯续篇未接入：落点争位虽必要却由唯一安全离开自动触发；运送稿能同最优地分别处理两鬼；单楼梯共享保护稿无解，一处连接的31项对照中13项可解却均有同最优的无互挡通关。相关原稿、错误查询及修正留在[落点研究](../examples/discovery-course-20261023/drafts/stair-priority-20261025/)、[运送研究](../examples/discovery-course-20261023/drafts/transport-helper-20261025/)、[共享小室](../examples/discovery-course-20261023/drafts/shared-stair-controls-20261025/)。不继续加机关修补这组，后续换整体关系；此局部否决不扩大为所有楼梯题都无价值。

新的[0门开视线试构](../examples/discovery-course-20261023/drafts/open-sight-selector-20261025/)也未接入：普通门仍有相同15步参考，且原稿有15步最优重合捷径。一步对照工具补齐重合、层内重复编号和实际终局的区分；不是修改物理规则，也不把互动必要当趣味。

另排除[回程出口与双0小室](../examples/discovery-course-20261023/drafts/control-and-zero-counterexamples-20261025/)：前者的两个A控制没有参与16步参考，后者仍不成立。它们不接入，也不靠新增机关修补。 后续[共享庭院、单楼梯返回与四小室](../examples/discovery-course-20261023/drafts/shared-returns-20261025/README.md)同样未采用：有的是尾随一圈或独立角色，有的是最优重合；17步楼梯稿虽安全，仍没有提出区别于分区搬运的新理解。

此前三鬼入口的比较未采用：[腾位目标调整与双环反例](../examples/discovery-course-20261023/drafts/three-ghost-and-direction-20261026/README.md)未接入。内收24步稿仍主要尾随，缩圈改变了停位，去保护出现到达死亡捷径；双环箭头允许方向从终点出发，非终局全图等价于墙。后续在构思时先核对方向的真实用途，不能用普通门出现捷径代替。

新的[共用落点、十字庭院、双取物与双叶方向往返](../examples/discovery-course-20261023/drafts/shared-landing-and-cross-court-20261026/README.md)也不接入：有的无解，有的只是逐只安置或重复现有方向关；安全十字三鬼稿也未仅凭增加威胁递补。41项有限对照保留，未替换既有46。

[三路方向取物的26项对照](../examples/discovery-course-20261023/drafts/directional-theta-20261026/README.md)未接入：唯一合格21格稿仍是熟悉的绕回取物，普通替代保留25步完整动作而另增合并分支，不把过滤分支当方向新意。原卡只改初位，扩展又加面积与两处保护，已明确属于改题；这组不继续追加机关。公开36关保持。

观察机会不等于玩家学会。已复查[知识前提与早段续解](../examples/discovery-course-20261023/reviews/knowledge-assumptions-20261025.md)，撤回把实墙遮挡误归给普通门的初步判断；第2关填格取消原调动问题，未采用。其它曾否决的回程稿保留[具体反例](../examples/discovery-course-20261023/reviews/direction-observation-and-return-counterexamples-20261025.md)，不重复复活。

## 当前验收与基线

逐关预加载与审查说明已发布Site第88版，保持公开。电脑与手机各遍历36关，只发生一次游戏文档加载；各图初态与共同引擎一致，换关后输入、快速连续选择、前后回切及准备期间保留局面／草稿通过。不同源与旧版降级、清单重排／本关改码／移除不重载当前局面另验。说明36个定位、手机阅读、下载与仓内唯一文字源一致。记录见[交付核对](../examples/discovery-course-20261023/review-delivery-check-20261026.json)；本地耗时不是公网速度或真人体验。

36关构造器、存图与证书在[现版绑定记录](../examples/discovery-course-20261023/certificate-check-redesign-20261023.json)核对；共同规则锁`sha256:69f3b7eea3dce5d2a53acf41074ebbeb289e1a49c4f45f30018b7dbad71cfed0`。全部最优重合边界、去终点安全、指定真正外侧入场与编码分别留证；有鬼图另查编号，无鬼50、51不冒称鬼编号试验。

52现v02的[电脑22步／手机24步](../examples/discovery-course-20261023/zero-opening-browser-check-20261025.json)、54的[两条35步及跨层回放](../examples/discovery-course-20261023/overpass-browser-check-20261025.json)均逐步核对全部层的角色、门与资源。其它关卡操作范围统一见课程目录，不把一次换关首触控冒称整图复验。 新复用55的[电脑／手机22步及前后换关](../examples/discovery-course-20261023/suspended-browser-check-20261025.json)通过，另核对开0、两次A的撤销／重做及同页求解回放。 56的[电脑／手机两种44步及前后换关](../examples/discovery-course-20261023/borrowed-route-browser-check-20261026.json)也通过，五次取物／开门撤销重做、同页求解与切解回放保留原局。

新57的[电脑／手机23步](../examples/discovery-course-20261023/inner-queue-browser-check-20261026.json)核对三次A、入室与东向争位、撤销重做和同页求解回放；[失败恢复与旧清单刷新](../examples/discovery-course-20261023/inner-queue-recovery-and-refresh-20261026.json)补验死亡撤回及插入第10关后旧局面不重载。57加入时其它34图码保持，后续同行不再称首次三鬼。

58的[电脑／手机26步与34步恢复](../examples/discovery-course-20261023/shared-slot-browser-check-20261026.json)核对两层角色、门、资源和全部转层；跨层A、撤销重做、同页求解切解回放及54→58→54通过。两个视口两层图均检视；仍非真人过程。

54还补验[跨层攻击与上层碰鬼的失败恢复](../examples/discovery-course-20261023/overpass-recovery-check-20261025.json)：四次电脑／手机仿真均可死亡撤销、重做、复活后撤回，并从开局再通关。当前主站已由本地e91dafb改为显示死亡瞬间，逻辑与记录仍使用复活后局面；按既定显示方案核对，不回退本体，也不把旧验收预期误报成bug。

最新npm test与cloud:check通过，本体、AI、规则锁、原种子及22个HTTP入口通过；当前环境Node24，未重做Node22验收。本体正式基线94d49a5；本地main已提交4cd4d31的嵌入预加载支持，仅在Site预览使用，未经本轮正式发布认可不推送本体main；正式地图集21张、站主优化10张保持。两个main开工及推送前fetch核对，保留本地用户更新，不reset、rebase或覆盖。

实际缺失仍是未知规则真人的过程：按钮是否能被发现、跨度、失败原因与后段重复感。没有补评分、用时、提示或尤里卡记录，原图好评不转移给变式或关序。手机方向盘默认会遮住重做，拖开后可操作；本体未修，仿真也不等于真实手机验收。

## 按需资料与历史

设计经验读[方法](methodology.md)，约束读[设计边界](design-boundaries.md)，作品和真实反馈查[地图总目录](ai-map-catalog.md)及本体[人读小册](https://github.com/Pre-rice/ghost-maze/blob/main/docs/map-design-guide.md)。本次收紧前的完整状态在[状态快照](archive/worklogs/status-before-single-shaft-review-20261025.md)，更早研究索引由其中链接追溯；旧停点不能当当前指令。

私人原件、真人录制与研究QA分开。最新完整私人包仍`cloud-data-20261023-planning-129.zip`；130外侧入场、131入口承诺反例、132三图真实反馈都是补充包，先恢复129再按序恢复130／131／132。逐文件清单与历史位置在上述状态快照；恢复流程见[云端说明](codex-cloud.md)，不能只恢复最大编号补充包。新公开关卡及研究证据通过Git保存，未产生新真人记录或训练数据包，也未称用户已下载旧包。
