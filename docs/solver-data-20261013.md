# 2026-10-13 求解器资料制备

[《借道》](../examples/borrowed-route-20261013/README.md)已生成44个规划状态监督样本，版本 demonstration-v3-physical-boundaries。每行包含全信息物理局面、可执行／当前安全动作、一条最优延续动作及精确剩余动作数；没有把未选动作标成错误，也没有把样本当作真实探索玩家的视野数据。

来源固定为 solver_certificate，地图与规则标识、分享地图、动作码、亲缘家族均核对。真实录制使用原有独立入口；求解器证书不写入 data/solutions 或 feedback。质量标签为空，真人评述与参考仍独立保存，trainStarted:false。44行是一个题一家族的44个局面，不能作为44个独立偏好样本。

prepareDemonstration 现在要求整图全部并列最优解无非死亡重合，并完成玻璃换墙的全可达物理策略检查；未知或冲突都拒绝。原来只核验所选示范最优，因此会漏掉另一条同长解利用重合的图，此次回归覆盖该情况。非最优重合仍允许，不扩大用户规则。边界预算可以与求解预算分开提供，完整审查结论保存在清单与行策略元数据。

鬼的位置数组按坐标规范排序并保留数量；编号／排列不进入规划动态输入。只改数据表示，原录制和身份事件研究不动。源文件校验和、边界策略、数据版本与家族记录见[data-preparation.json](../examples/borrowed-route-20261013/data-preparation.json)；原生成资料保存在忽略的 runs/door-mainline-20261013/solver-demonstration-v3，旧输出原样保留。

复现到一个新目录：

```sh
node scripts/prepare-solver-demonstration.mjs examples/borrowed-route-20261013/map.json examples/borrowed-route-20261013/share.json runs/borrowed-route-data-new door-cooperation-20261013-v1
```

目标目录已存在会在制备前拒绝，实际重试已验证原清单与行文件未变化。历史 demonstration-v1 与探索中的v2不会自动取得v3边界／表示验收；没有批量覆盖旧资料或私人原件。

这一成果为求解器学习准备监督数据，没有启动训练，也没有宣称质量模型能识别顿悟。当前仍缺新的真人路线、比较反馈和更多独立设计家族；主线仍优先构造有新意、简洁的谜题，而非用大量亲缘改图填满数据。
