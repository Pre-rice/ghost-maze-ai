# 当前状态

更新：2026-10-25。目标是好谜题与可推断的尤里卡时刻；训练是可选手段，当前不启动训练。

## 当前任务与持续范围

用户授权设计几乎没有文字教程、玩家起初不知道规则的逐关关卡，只做死亡循环。先用少数元件支持完整谜题，让规则在探索、试错与改变计划中被发现，再逐步加入新元件。不要逐条规则配一关，不恢复被否定的机制演示串，也不以证书、步数或必要性代替趣味。最新整体反馈及原话见[课程记录](../examples/discovery-course-20261023/reviews/teaching-feedback-20261023.json)。

持续自主设计、验证与更新公开试验线路，无需逐关请求试玩或审批。当前范围不含本体代码、界面、正式地图集或自动试玩skill；未成题原型不为凑关发布。此前《回流》《换庭》《进退》的负反馈与冻结保持，本次课程授权不等于恢复旧近亲递补。

## 公开试玩与当前取舍

[鬼迷宫 · 初见](https://ghostmaze-discovery-path.prerice.chatgpt.site)已公开给所有人。目前公开29关，12张课程专用图、17张既有图的复用或课程变式；来源与是否已获评价逐项列在课程表，《对门》明确来自未评价研究稿。均不继承为本次未知规则体验已获好评。

Site项目`appgprj_6adb4b311474819180db83f0509d84e1`；源码在独立Site仓，工作目录`/workspace/sites/ghostmaze-discovery-path`。仅公开稳定ID与正式站游玩入口，不公开解法、规则或设计思想；关序变化保留正在玩的局面。按[课程目录](../examples/discovery-course-20261023/README.md)与其中`course-order.json`推进，ID不是关序。原31关已留档撤下。

- 前五关围绕墙、鬼与普通门形成引离、调位、返回及共同阻路；不恢复逐步执行的观察小关。第五关增加短墙，保留最优及左上调动，整理短试探中的无关合并，见[修订取舍](../examples/discovery-course-20261023/reviews/early-ghost-observation-20261024.md)。首A已改为完整往返。
- 新关45为13格单A双鬼完整问题，接在首A后，再进入《错位》的A/B；不为困鬼另设短演示。《接力》据此承接已有主动保护与换控制经验，继续两组保护和多鬼准备。75步《换岗》课程适配44撤下，原稿与正式集保持；不是把49步删掉后段的改稿冒称等价优化。[取舍、来源与范围](../examples/discovery-course-20261023/reviews/single-letter-application-20261024.md)。
- 《暂驻》《再借》《对门》从重新引走推进到借鬼和共同安置。《对门》明确是未评价研究复用。[较后位置的依据](../examples/discovery-course-20261023/reviews/shared-trap-after-recruitment-20261024.md)。
- 首次方向改用11格无鬼控制室50：在室内关回B重新接通外部，再经单向口出来；随后46继续同种元件与双鬼停位、取物回程。50不是最高难度突破，是否显教学仍待真人；46存在同16步无实际互挡方案，不强称借鬼必学。原43、正式《归途》及其认可保持。[当前取舍](../examples/discovery-course-20261023/reviews/control-circuit-20261025.md)。

新增15格无鬼控制访问题51，接在46与《侧入》之间：A会关住内B入口，取物前先准备B，带钥匙回来再恢复A；不把同一次序照走两遍。两个方向口各有具体进出作用，未采用给旧控制室机械加鬼的稿。[当前取舍](../examples/discovery-course-20261023/reviews/controller-access-20261025.md)。

18格阶梯形49仍接在《再借》与《对门》之间，v02以三处取物配2门，在同一完整问题里提供可余钥匙通关的机会；全部三条17步最优动作与玩家／鬼帧保持，也可19步收齐。此为任务选择与引导调整，不称推理难度增强；v75单钥匙稿及其证据保持。[当前取舍](../examples/discovery-course-20261023/reviews/key-choice-20261025.md)。

新增20格双鬼保护交接题48，放在《对门》与《换席》之间；取物后由A接管B的保护，B再打开目标房。两钥匙与1／2门在完整任务中使用，原75步44仍撤下。[布局取舍、普通计划及范围](../examples/discovery-course-20261023/reviews/protection-handoff-20261024.md)。

《侧入》用18格双鬼变式替换同一位置，删去独立的首鬼前置，保留由终局倒推接近侧；首次完整三鬼任务留给《同行》。[取舍及后缀对应范围](../examples/discovery-course-20261023/reviews/side-entry-focus-20261024.md)。

《同行》的普通通关与51步优化时机已分开：52步也可在A后召回。下一关仅沿用召回、借鬼与控距，不将最优细节当作必然学过；地图和关序不改。[衔接范围](../examples/discovery-course-20261023/reviews/ordinary-clear-and-optimal-timing-20261024.md)。

《布阵》的四种三鬼减负稿均未采用：两稿有最优重合，另两稿绕过A/B工作空间关系；原四鬼及关序保持。后段按整体调度、撤去保护、回合相位区分，不把它们写成再新增第三只鬼。[实际对照与范围](../examples/discovery-course-20261023/reviews/late-course-scope-20261025.md)。

这些是设计假说，仍缺真正未知规则玩家的尝试过程：首次按钮是否易于发现、关键跨度和后段重复感如何。没有补写评分、用时、提示或尤里卡记录，不将来源图好评转移给新变式或关序。

已复查[观察机会与前段错误续解](../examples/discovery-course-20261023/reviews/knowledge-assumptions-20261025.md)：不把早段保护当作已完整理解门的遮视线，也不把一次阻路当作已懂全部优先规则。第2关填格会取消原调动问题，未采用；该复查不改图或关序，不为追求全部可恢复而增加说明关或削弱原题。

## 当前验收与基线

29关构造器、现存地图和证书绑定已核对，共同规则锁为`sha256:69f3b7eea3dce5d2a53acf41074ebbeb289e1a49c4f45f30018b7dbad71cfed0`。全部最优重合边界、去终点安全、指定实际中性入场及码往返分别留证；有鬼图另验编号无关，无鬼50、51不冒称编号试验；证据范围见[现版核对](../examples/discovery-course-20261023/certificate-check-redesign-20261023.json)。

当前29关的物理证书绑定通过；加入51后的npm test与cloud:check通过两仓、规则锁、原种子及22个HTTP入口。当前环境Node24，未重做Node22验收；发布版本见[发布记录](../examples/discovery-course-20261023/site-publication.json)。

49当前三钥匙稿的两类17步、19步收齐已逐步核对玩家／鬼／资源与钥匙显示；电脑、手机触控仿真及18→49→42换关通过，见[现版操作记录](../examples/discovery-course-20261023/key-choice-browser-check-20261025.json)。原单钥匙稿另存，不混称为同一资源任务。[原操作范围](../examples/discovery-course-20261023/levels/49/revisions/v01/browser-check.json)。

新50另过[电脑／手机触控、门态和换关](../examples/discovery-course-20261023/control-circuit-browser-check-20261025.json)，两种17步室内安排均通关；电脑撤销／重做与网页求解17步、一种解法一致。完整42态均可继续通关只是可恢复性证据，不等于玩家会找到。

新51另过[28步两端操作与资源帧](../examples/discovery-course-20261023/controller-access-browser-check-20261025.json)，取物前后A均验电脑撤销／重做；网页求解28步、一种解法。104个完整可达局面均可继续通关，只是可恢复性证据；46→51→47换关通过。

重点接点的电脑／手机触控及全部玩家与鬼帧分别留证：[37→45→13](../examples/discovery-course-20261023/single-letter-browser-check-20261024.json)、[42→48→19](../examples/discovery-course-20261023/protection-handoff-browser-check-20261024.json)、[46→47→27](../examples/discovery-course-20261023/side-entry-browser-check-20261024.json)。方向关两种停位另有[操作记录](../examples/discovery-course-20261023/directional-flow-browser-check-20261024.json)。截图与触控分开，不把自动化现象或物理QA当成未知规则真人体验。

已验[首关死亡恢复](../examples/discovery-course-20261023/trial-recovery-check-20261024.json)，新48另验[钥匙、数字门、重置及死亡撤销／重做](../examples/discovery-course-20261023/key-history-browser-check-20261025.json)，均可回初态继续通关。手机仿真默认方向盘会遮住“重做”，拖开后可操作；本体未修，不能称默认布局无障碍或真实手机已验收。

本体基线main为94d49a5，本任务没有改动；正式地图集21张、站主优化10张保持。开工及推送前继续fetch核对本地用户更新，不回退或覆盖。地图与回放只用正式域名；本课程Site例外由用户明确授权。

## 按需资料与历史

设计经验读[方法](methodology.md)，实际约束读[设计边界](design-boundaries.md)，作品与真实反馈查[地图总目录](ai-map-catalog.md)及本体[人读小册](https://github.com/Pre-rice/ghost-maze/blob/main/docs/map-design-guide.md)。此前作品和研究结果已完整移到[整理前状态快照](archive/worklogs/status-before-course-cleanup-20261024.md)，只在追溯或复用时查，不重跑已完成研究、不把旧停点当现行任务。

原图、生成来源、真人反馈与QA分开，历史资料和旧包保持。最新完整私人快照为 `cloud-data-20261023-planning-129.zip`，独立核对[单鬼反向预备](../data/manifests/oneway-overshoot-and-single-ghost-20261023.json)37份新原件；另有[外侧进场补充130](../data/manifests/oneway-overshoot-exterior-entry-20261023.json)两份与[入口及承诺反例补充131](../data/manifests/oneway-admission-and-commitment-counterexamples-20261023.json)23份，以及[三图真实反馈补充132](../data/manifests/oneway-three-review-20261023.json)一份；三包均依赖完整129，不是完整快照，恢复时先129再130、131、132；此前各批入口见上述研究记录与对应逐文件清单，不回写冻结原件。69曾因连接中断未完成，不作有效包；未称用户已下载。付费与GPU不自动启动。
