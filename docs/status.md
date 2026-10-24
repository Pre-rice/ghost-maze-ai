# 当前状态

更新：2026-10-24。目标是好谜题与可推断的尤里卡时刻；训练是可选手段，当前不启动训练。

## 当前任务与持续范围

用户授权设计几乎没有文字教程、玩家起初不知道规则的逐关关卡，只做死亡循环。先用少数元件支持完整谜题，让规则在探索、试错与改变计划中被发现，再逐步加入新元件。不要逐条规则配一关，不恢复被否定的机制演示串，也不以证书、步数或必要性代替趣味。最新整体反馈及原话见[课程记录](../examples/discovery-course-20261023/reviews/teaching-feedback-20261023.json)。

持续自主设计、验证与更新公开试验线路，无需逐关请求试玩或审批。当前范围不含本体代码、界面、正式地图集或自动试玩skill；未成题原型不为凑关发布。此前《回流》《换庭》《进退》的负反馈与冻结保持，本次课程授权不等于恢复旧近亲递补。

## 公开试玩与当前取舍

[鬼迷宫 · 初见](https://ghostmaze-discovery-path.prerice.chatgpt.site)已公开给所有人。目前公开25关，7张课程专用图、18张既有图的复用或课程变式；来源与是否已获评价逐项列在课程表，《对门》明确来自未评价研究稿。均不继承为本次未知规则体验已获好评。

Site项目`appgprj_6adb4b311474819180db83f0509d84e1`；源码在独立Site仓，工作目录`/workspace/sites/ghostmaze-discovery-path`。仅公开稳定ID与正式站游玩入口，不公开解法、规则或设计思想；关序变化保留正在玩的局面。按[课程目录](../examples/discovery-course-20261023/README.md)与其中`course-order.json`推进，ID不是关序。原31关已留档撤下。

- 前五关围绕墙、鬼与普通门形成引离、调位、返回及共同阻路；不恢复逐步执行的观察小关。首A已改为完整往返，不提前拆掉《错位》《接力》的关键发现。
- 《暂驻》《再借》《对门》从重新引走推进到借鬼和共同安置。《对门》明确是未评价研究复用。[较后位置的依据](../examples/discovery-course-20261023/reviews/shared-trap-after-recruitment-20261024.md)。
- 新增《换岗》安静开场课程变式，保留原四条主要最优角色流程；数字门消失后交接保护，再由《换席》让立即关门也不再适合取物。原用户图不改，75步的操作负担仍需真实反馈。[取舍与原图对照](../examples/discovery-course-20261023/reviews/whole-problem-and-two-key-handoff-20261024.md)。
- 首次方向限制由双端取物小室43承担，替代《归途》的课程位置，要求先为退出准备；不是给旧题前面再加箭头说明关。《归途》的正式图与认可保持。[位置依据](../examples/discovery-course-20261023/reviews/directed-key-chamber-placement-20261024.md)。

这些是设计假说，仍缺真正未知规则玩家的尝试过程：首次按钮是否易于发现、关键跨度和后段重复感如何。没有补写评分、用时、提示或尤里卡记录，不将来源图好评转移给新变式或关序。

## 当前验收与基线

25关构造器、现存地图和证书绑定已核对，共同规则锁为`sha256:69f3b7eea3dce5d2a53acf41074ebbeb289e1a49c4f45f30018b7dbad71cfed0`。全部最优非死亡重合、去终点安全、指定实际中性入场、编号无关及码往返要求分别留证；证据范围见[现版核对](../examples/discovery-course-20261023/certificate-check-redesign-20261023.json)。

本轮新增双钥匙图通过桌面／手机视口正式站真实键盘操作；首A和随后《错位》另完成纯触控仿真与“下一关”切换，见[触控记录](../examples/discovery-course-20261023/touch-letter-check-20261024.json)。这不是实际手机硬件、AI自主试玩或真人学习验收。统一cloud:check已通过两仓、规则锁、原种子及22个HTTP入口；当前环境Node24，未重做Node22验收。Site已原生发布成功，当前版本标识见[发布记录](../examples/discovery-course-20261023/site-publication.json)。

本体基线main为94d49a5，本任务没有改动；正式地图集21张、站主优化10张保持。开工及推送前继续fetch核对本地用户更新，不回退或覆盖。地图与回放只用正式域名；本课程Site例外由用户明确授权。

## 按需资料与历史

设计经验读[方法](methodology.md)，实际约束读[设计边界](design-boundaries.md)，作品与真实反馈查[地图总目录](ai-map-catalog.md)及本体[人读小册](https://github.com/Pre-rice/ghost-maze/blob/main/docs/map-design-guide.md)。此前作品和研究结果已完整移到[整理前状态快照](archive/worklogs/status-before-course-cleanup-20261024.md)，只在追溯或复用时查，不重跑已完成研究、不把旧停点当现行任务。

原图、生成来源、真人反馈与QA分开，历史资料和旧包保持。最新完整私人快照为 `cloud-data-20261023-planning-129.zip`，独立核对[单鬼反向预备](../data/manifests/oneway-overshoot-and-single-ghost-20261023.json)37份新原件；另有[外侧进场补充130](../data/manifests/oneway-overshoot-exterior-entry-20261023.json)两份与[入口及承诺反例补充131](../data/manifests/oneway-admission-and-commitment-counterexamples-20261023.json)23份，以及[三图真实反馈补充132](../data/manifests/oneway-three-review-20261023.json)一份；三包均依赖完整129，不是完整快照，恢复时先129再130、131、132；此前各批入口见上述研究记录与对应逐文件清单，不回写冻结原件。69曾因连接中断未完成，不作有效包；未称用户已下载。付费与GPU不自动启动。
