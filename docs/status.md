# 当前状态

更新：2026-11-17。当前任务是未知规则、几乎无文字教程的逐关发现线路，仅死亡循环。用户授权持续设计并同步公开试玩，稍后审查；不以实验、提交或发布当停点。不启动训练、付费调用、GPU，也不自动调用手动试玩skill。

## 公开产品与入口

[鬼迷宫·初见](https://ghostmaze-discovery-path.prerice.chatgpt.site)对所有人公开，当前49关，Site122原生部署成功。成功后未访问部署重复核验；[精确发布记录](../examples/discovery-course-20261023/site-publication.json)保存来源、版本和部署ID。[唯一人读审查说明](../examples/discovery-course-20261023/review-guide.md)逐关列来源、实际改动、设计意图和待审；网页可定位当前关，正常游玩不显示设计提示。

顺序唯一来源为[course-order.json](../examples/discovery-course-20261023/course-order.json)，目录ID不等于关号。1—6墙、追逐与普通门；7—13延续A及A/B；14首次钥匙、19首次0，资源与安排到33；34—37方向和控制可达性；38—45多鬼与既有策略；46—49楼梯。观察不当掌握，原作好评不转移给改图或关序。人读来源口径仍18认可作品来源、5未评价研究、26课程新构／重构；构造器26课程专用、23复用／变式，两种口径分开。

Site源码在`/workspace/sites/ghostmaze-discovery-path`。仅一个游戏实例，预加载最多两相邻地图；清单变化保留正在玩的旧码、控制器、局面和草稿，退下题及旧修订可继续，主动换关／刷新才载入新稿。独立地图和回放用https://ghostmaze.novic.cc/；课程Site是用户明确授权的逐关试玩例外，不自动打开侧边页。

## 最近完成

以下都是课程候选，工程验收不代替未知规则真人的趣味、顿悟和跨度判断，未擅自入正式地图集。

| 现关号／ID | 本次改变与已知范围 | 设计及验收 |
| --- | --- | --- |
| 22／52 v03《逆渡》 | 仅出生移位，22格22步保持；原两种准备与24条最佳保留，另四条上侧引动。正在同步，公网Site122仍旧出生。旧v02原样保存，旧局死亡也回旧出生。 | [开局与范围](../examples/discovery-course-20261023/drafts/reverse-gate-entry-review-20261117/README.md) · [浏览器](../examples/discovery-course-20261023/reverse-entry-browser-check-20261117.json) |
| 49／72 v02《留层》 | 去A、上钥匙与下目标重设，24变25格27步。原v01保持；完整禁重合任务的两次保护都需要。23格左移虽24步，却有34步无实际影响方案，拒绝。 | [重画与取舍](../examples/discovery-course-20261023/drafts/key-room-before-parking-course-20261117/README.md) · [浏览器](../examples/discovery-course-20261023/stair-key-revision-browser-check-20261117.json) |
| 7／37 v03《远门》 | 普通门由下移右，原下口封墙，19收15步；实体与十格保持，停车侧改变，非旧解逐帧等价。两种开侧路稿均有20步一次A，拒绝；最终恢复要求保留。原v02四件归档、v01保持，同ID旧局两端可继续。 | [取舍](../examples/discovery-course-20261023/drafts/first-letter-door-relocation-course-20261117/README.md) · [浏览器](../examples/discovery-course-20261023/first-letter-relocation-browser-check-20261117.json) |
| 14／77《两面》 | 替换63双鬼22步，主动取消双守卫准备。单鬼14格、14步六走法／四鬼动停类，先外停或先取物再内停两策略；撤回唯一右停假说。原63也能先探门，不说旧图不许探索。旧63四件与说明保持。 | [判断变化](../examples/discovery-course-20261023/drafts/first-key-parking-course-20261117/README.md) · [浏览器](../examples/discovery-course-20261023/first-key-parking-browser-check-20261117.json) |
| 25／75《伴归》 | 替换61长回程稿，18格26步两类；旧鬼回程再成威胁，要保留新追者保护。原20格不必要0删去、收两格，非旧携影等价精简。旧61四件保持。 | [完整任务](../examples/discovery-course-20261023/drafts/escort-return-course-20261117/README.md) · [浏览器](../examples/discovery-course-20261023/escort-return-browser-check-20261117.json) |
| 27／73《先后》 | 借途49后加入两份资源共同准备，18格22步一类。临时原件失于环境快照，按明确记录重建并重新验，未冒称原件找回。原48码当时保持。 | [来源](../examples/discovery-course-20261023/drafts/two-retrievals-course-20261117/README.md) · [浏览器](../examples/discovery-course-20261023/two-retrievals-browser-check-20261117.json) |
| 37／76《闭环》 | 替换60纯机关稿，16格无鬼18步；B过口前还、A进入后从内侧还。删强迫开局A门、出生移离按钮；先物后A22步、外侧误恢复A26步可补救。旧60保持。 | [完整范围](../examples/discovery-course-20261023/drafts/self-closure-return-course-20261117/README.md) · [浏览器](../examples/discovery-course-20261023/closure-return-browser-check-20261117.json) |
| 48／74《迁居》 | 替换58，17格双层15步；完整取物任务需要两鬼实际换层。无资源原稿可19步逐只，未转写成新稿必要性。旧58四件与说明保持。 | [完整任务](../examples/discovery-course-20261023/drafts/exchanged-floors-course-20261117/README.md) · [浏览器](../examples/discovery-course-20261023/exchanged-floors-browser-check-20261117.json) |

这些改图分别验全部最优、去终点、码往返、冷开局、实际外侧入场，涉及鬼者另验编号；具体完整历史和删改范围见各研究目录，不用一条参考代替全解。两端操作、回放、恢复、错误撤回和旧局保留均有独立记录，画面已检视。17日最近cloud:check通过159测试、旧4文件、两原种子和22 HTTP入口；没有声称重跑全部49图。

## 下一步与真实缺失

第22《逆渡》v03出生调整已验收，正在同步公开页。原24条首步映射保留，新增四条同22步上侧引鬼；0首次开口方向与取物顺序的完整要求保持。原首上与新首下之后1323态6475原生后继对应，复活后和观察除外。原图也能先探目标，不说它不许探索。28类两端644帧均核对；当前UI只显首个求解入口，其余27经应用方法验证。旧52更新后的死亡仍到原出生、可撤回，主动刷新才新出生；两旧证明固定v02，不让旧证据跟构造器漂移。

第49《留层》v02重画已验收并以Site122公开，原生成功后未重复访问线上部署。25格去A，钥匙到楼上守卫后、目标到楼下守卫后1门，27步唯一。原v01四件原样保留；原37步独立安置不再完成新目标，完整禁重合任务分别跳过两个梯口的任一次保护均无解。上鬼不能迁层，下鬼可中途转层后返回；不把41／43步迂回当另一设计策略。最初“先搬上鬼下去再停车”的卡被实际反例撤回。[取舍与范围](../examples/discovery-course-20261023/drafts/key-room-before-parking-course-20261117/README.md)及唯一人读说明已同步。23格左移压缩虽24步最佳安全，却有34步无实际互相影响通关，故拒绝；上层两底格保留31步恢复选择。

全部最优、去终点、跨层编号／码、801态3970后继的外侧入场，以及电脑／触屏操作、29／31／35步恢复、四死亡与四无效、十一处历史、28帧回放通过，六图已检视。旧72两端继续第2步、主动刷新才载v02；其余48码与49项关序保持。17日cloud:check再通过，未声称重验全部49图。下一组继续比较中段不可逆门与方向应用的完整关系，避免把新增走法或更近出生当成新颖性；不继续给留层或第三鬼稿添机关。

未采用研究仍由目录保留：[出口反相门](../examples/discovery-course-20261023/drafts/stair-exit-commitment-course-20261117/README.md)、[交叠小院](../examples/discovery-course-20261023/drafts/crossed-stair-courts-course-20261117/README.md)、[借道单守卫](../examples/discovery-course-20261023/drafts/one-key-two-passages-course-20261117/README.md)、[第三下守卫](../examples/discovery-course-20261023/drafts/shared-downstairs-parking-course-20261117/README.md)。本轮还校正七份当前编排说明中对旧35／50／63和旧首次资源位置的残留，未因此改图。原72十四单删未重复，新25格任务十六单删另有明确范围。

区分有价值的另一策略与跳过课程核心：两面取物前后安置都保完整任务，故保留；远门一次A绕过恢复则放弃。多解、独解、必要性、步数和可达态都不作趣味评分。继续设计并同步，用户未指定新停点；不向用户发起重复上架审批。

实际缺失是未知规则真人过程：前段是否仍像教学或只有唯一安全方向；两面是否过浅、门位是否太明显、资源能否自行理解；伴归与再借是否重复；闭环是否只是ABBA执行；楼梯几题是否只是跨区搬运、观察是否负担、普通方案是否避开了预期发现。当前新／改稿无此类反馈，未虚构人类用时、评分、AI盲试玩感受或已学会结论。

现有预览求解识别多个鬼过程类，但界面只显示首个回放入口；两面的四个实际代表覆盖全部类，其余三类通过同一应用方法逐帧核对，不冒称四个链接均可点。本轮未扩范围改本体UI。触屏模拟不是实际手机。

## 协作、规则与资料

两仓默认main，开工／推送前fetch；有远端更新先快进或正常合并，不reset、rebase、强推或覆盖。用户本地DeepSeek可改本体，小改也可能触发跟随引擎锁；以实际远端核对。当前本体main为94d49a5，本轮未改；正式地图集21张、站主优化10张保持。未审批的4cd4d31嵌入支持只在Site的preview-game快照，不能因此推正式main；正式UI仍需用户认可预览后发布。Vercel由本体main推送触发，本轮没有触发。

共同规则锁为`sha256:69f3b7eea3dce5d2a53acf41074ebbeb289e1a49c4f45f30018b7dbad71cfed0`，同级本体core唯一来源，Node22.21.1。参考、网页求解与回放物理一致；单元外入口只声明所列钥匙数、区外实体和初相位，不外推任意整图。训练边界沿用全部最优不利用非死亡重合、玻璃不改变解谜物理；未知不放行。

私人资料129为基础、130／131／132为补充；17日恢复时未核对全部私人包，本轮公开课程不依赖它们，无新增真人或训练资料，不覆盖旧包。恢复读[云端说明](codex-cloud.md)。方法归[methodology](methodology.md)，地图及真实反馈归[总目录](ai-map-catalog.md)，职责见AGENTS。

[整理前至Site120的完整状态](archive/worklogs/status-through-site120-20261117.md)只供追溯，不作当前指令。更早课程、未采用研究、环境恢复与证据都由该档案和逐关来源链接索引，不在当前入口重复全过程。
