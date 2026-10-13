> 历史资料：保留整理前的判断与过程，不代表当前任务或状态。现行入口见[文档索引](../../README.md)。

# 当前收尾（2026-10-13）

《再借》按用户明确决定上架，地图集按首次交付排序。最新清单[planning-library-20261013-v7.json](../../../data/manifests/planning-library-20261013-v7.json)：14图634行，十一上架／三候选，一件未评候选；十四图逐行校验和完全保持，两个保守亲缘组，未训练。新输出`runs/door-mainline-20261013/planning-library-v3-gallery-11`；下文保留以前各快照，不视为当前状态。

# 2026-10-13 求解器资料制备

最新更新：《再借》44行已纳入[planning-library-20261013-v6.json](../../../data/manifests/planning-library-20261013-v6.json)，当前14图634状态、十上架与四候选，两个保守亲缘组；原十三图行与十图源码相同。借道／再借未评、借舍一般、折返明确否决；定性评价独立，质量分空，未训练。

复现：`node scripts/prepare-planning-library.mjs runs/planning-library-new-14 examples/borrowed-route-20261013/share.json examples/returning-guard-20261013/share.json examples/borrowed-room-20261013/share.json examples/recruited-return-20261013/share.json`。

此前反馈更新：《借舍》评价一般、没有新意或难点，左上及突出出生格冗余经实际对照证实；[复盘](../reviews/borrowed-room-review-20261013.md)独立保存。十图上架保持，13图590行仍一致，最新[planning-library-20261013-v5.json](../../../data/manifests/planning-library-20261013-v5.json)区分借道未评、折返否决和借舍已有一般反馈。未将一般评述等同明确上架否决，未补数值评分或训练。

此前上架更新：《暂驻》获用户“好图、简洁、一定挑战性”的真实肯定并明确选入地图集。十张上架与三个候选仍共13图590个全信息规划状态，十三图逐行校验和保持；借道／借舍未评、折返否决，两个保守亲缘组。最新清单[planning-library-20261013-v4.json](../../../data/manifests/planning-library-20261013-v4.json)。上架与肯定见[评述](../reviews/temporary-stay-review-20261013.md)，没有伪造数值质量分、真人路线或模型训练。

复现：`node scripts/prepare-planning-library.mjs runs/planning-library-new-gallery-10 examples/borrowed-route-20261013/share.json examples/returning-guard-20261013/share.json examples/borrowed-room-20261013/share.json`。本题已从地图集读取，不重复传为候选；旧快照保持。


上架前更新：含《借舍》43行，当前13图590个全信息规划状态；两个保守亲缘组，三候选未评、《折返》有用户否决，九图保持。模型未训练。清单[planning-library-20261013-v3.json](../../../data/manifests/planning-library-20261013-v3.json)；旧12图行与九图源码校验和一致，旧11/12图快照保留。

复现：`node scripts/prepare-planning-library.mjs runs/planning-library-new-13 examples/borrowed-route-20261013/share.json examples/returning-guard-20261013/share.json examples/temporary-stay-20261013/share.json examples/borrowed-room-20261013/share.json`。



上一轮更新：已含《暂驻》39行，12图547个全信息规划状态；两组保守亲缘，尚未训练。九图保持，两个候选未评，《折返》已有否决评述／不入集。求解器示范仍可用于规划事实，不能变成好图正例或自动质量分。

新清单：[planning-library-20261013-v2.json](../../../data/manifests/planning-library-20261013-v2.json)。旧11图的行校验和及九图源码校验和保持一致，旧清单原样保留。来源状态区分上架、未评和已否决候选，定性反馈与空数值质量分分开。

复现到新目录：

```sh
node scripts/prepare-planning-library.mjs runs/planning-library-new-12 examples/borrowed-route-20261013/share.json examples/returning-guard-20261013/share.json examples/temporary-stay-20261013/share.json
```


[《借道》](../../../examples/borrowed-route-20261013/README.md)已生成44个规划状态监督样本，版本 demonstration-v3-physical-boundaries。每行包含全信息物理局面、可执行／当前安全动作、一条最优延续动作及精确剩余动作数；没有把未选动作标成错误，也没有把样本当作真实探索玩家的视野数据。

来源固定为 solver_certificate，地图与规则标识、分享地图、动作码、亲缘家族均核对。真实录制使用原有独立入口；求解器证书不写入 data/solutions 或 feedback。质量标签为空，真人评述与参考仍独立保存，trainStarted:false。44行是一个题一家族的44个局面，不能作为44个独立偏好样本。

prepareDemonstration 现在要求整图全部并列最优解无非死亡重合，并完成玻璃换墙的全可达物理策略检查；未知或冲突都拒绝。原来只核验所选示范最优，因此会漏掉另一条同长解利用重合的图，此次回归覆盖该情况。非最优重合仍允许，不扩大用户规则。边界预算可以与求解预算分开提供，完整审查结论保存在清单与行策略元数据。

鬼的位置数组按坐标规范排序并保留数量；编号／排列不进入规划动态输入。只改数据表示，原录制和身份事件研究不动。源文件校验和、边界策略、数据版本与家族记录见[data-preparation.json](../../../examples/borrowed-route-20261013/data-preparation.json)；原生成资料保存在忽略的 runs/door-mainline-20261013/solver-demonstration-v3，旧输出原样保留。

复现到一个新目录：

```sh
node scripts/prepare-solver-demonstration.mjs examples/borrowed-route-20261013/map.json examples/borrowed-route-20261013/share.json runs/borrowed-route-data-new door-cooperation-20261013-v1
```

目标目录已存在会在制备前拒绝，实际重试已验证原清单与行文件未变化。历史 demonstration-v1 与探索中的v2不会自动取得v3边界／表示验收；没有批量覆盖旧资料或私人原件。

这一成果为求解器学习准备监督数据，没有启动训练，也没有宣称质量模型能识别顿悟。当前仍缺新的真人路线、比较反馈和更多独立设计家族；主线仍优先构造有新意、简洁的谜题，而非用大量亲缘改图填满数据。

## 上一轮规划库（11图快照）

已对当前九张上架图与《借道》《折返》重新制备：11图、508行，每条参考均最优且整图所有最优路线边界通过。正式清单见[data/manifests/planning-library-20261013.json](../../../data/manifests/planning-library-20261013.json)。资料归两个保守亲缘组，按组整体划分；不能把11图或508个状态当成独立质量样本。新增真人质量标签零，模型未训练。重复制备逐行校验和一致，九图地图集源码也保持。

批量复现到新目录：

```sh
node scripts/prepare-planning-library.mjs runs/planning-library-new examples/borrowed-route-20261013/share.json examples/returning-guard-20261013/share.json
```

地图与家族必须在当前策略中登记，来源未知不猜测；重复同一地图拒绝，既有输出拒绝。私有原始行数据不提交公开仓库，源码、清单与可复核证据独立提交。

## 活着的困局对照

另制备四个可解性状态、两对对照，来源求解证据，不是额外四个谜题、真人犯错或偏好。所有前缀实际安全；两种续解求解器对正例均找到通关，反例均穷尽无伤无复活范围而无解。508条动作监督与这四个状态标签是不同任务，不混成512条最优动作。

《借道》的正反例玩家位置、两鬼位置、钥匙／物品和其他机关全部相同，唯一差别是下方0门仍关闭或已经打开。物理可见状态确有差别，不能称为相同局面由隐藏编号产生不同结果。该对照学习前瞻开路的影响；《折返》对照右侧调距后安全取钥匙与错误返回上方入口的活着困局。

清单见[planning-branch-contrasts-20261013.json](../../../data/manifests/planning-branch-contrasts-20261013.json)，原行与完整求解证据保存在忽略的runs/door-mainline-20261013/planning-branch-contrasts-v1。全信息范围明确，质量标签空，全部仍归新题的同一亲缘组，未训练。

## 《再借》提前控距的对照

新增加一对、两个全信息状态，见[清单](../../../data/manifests/planning-branch-contrasts-recruited-20261013.json)。RUUR与RURU均四个有效无伤动作，到同一玩家位置、同一门态，只有原下鬼公开位置差一格；前者可40步续解（原最优前缀），后者仍活着但双续解求解器穷尽无解。全部原本体可达分支及1690个编号／排列换位后继核验通过，未将不同鬼位称为完全相同场景。

与前四状态为三对六状态，和14图634个最优动作监督分开，不当六个新谜题、真人错误或质量偏好。原行和十图保持，未训练。完整原始行／证据在忽略runs/door-mainline-20261013/recruited-planning-contrast-v1；[分支证据及只读核验](../../../examples/recruited-return-20261013/README.md)在作品内。
