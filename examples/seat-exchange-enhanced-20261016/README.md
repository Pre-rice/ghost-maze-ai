# 《换席》· 用户增强版

2026-10-16，用户明确选入地图集，按发现顺序排第十四。16格、双鬼，一个A按钮、两扇反相A门、一扇普通门、一把钥匙及一道1钥匙门。用户原码逐字保留。

[试玩](https://ghostmaze.novic.cc/?map=AWM4wMBQAAKKnxu-OlgxVjAwcDUAhVi4DQQYGFgc5jQmMk1QYmpgEHAAAA) · [真实评述](../../docs/archive/reviews/seat-exchange-enhancement-20261016.md)

原AI版被评价为“不错的地图”，但“新意不大”。用户仅增加钥匙与数字门后认为“瞬间就变得很妙了”。这份好评关联用户增强版，不写回[原版来源](../seat-exchange-20261016/source.json)，两图也不是独立家族。原地图、生成时判断、全部证据保留。

<details><summary>设计关键与参考（含答案）</summary>

门旁开关通常可以困鬼，这个熟悉办法在取钥匙的新目标下不再充分。第27步所核对局面中，按A当步安全，但穷尽23个续解状态仍无伤无复活无解。暂不按A，继续借双鬼争位绕行，再把追鬼引到关闭的上A门右侧，便能安全取钥匙通关。

原版禁止旧鬼反向取得优先还有31步解；增强版中这条关系变成全解必要。禁止任一鬼停到关闭的上A门右侧也全续解无解。这些是设计者核验，不是补写用户完整操作或体验时间。

[44步参考回放](https://ghostmaze.novic.cc/?map=AWM4wMBQAAKKnxu-OlgxVjAwcDUAhVi4DQQYGFgc5jQmMk1QYmpgEHAAAA&replay=AIK7sy_nfArWUA9WYMOVeQ)。三种最优均仅第7步按A，保留鬼每步移动与停顿差别。

</details>

全部最优无鬼重合、去终点安全、分享往返通过；中性开局，指定外部(1,3)向右进入出生(2,3)，零钥匙、无外部鬼、其余外边封闭，全部最优内部局面一致。297个可达物理状态、2910次鬼排列及变编号后继比较通过。玻璃和楼梯均无。用户明确说明钥匙与鬼初始重合为无奈之举，按其原码保留。

`node examples/seat-exchange-enhanced-20261016/verify.mjs` 重验原码、全部最优边界、两个分支及新停位必要性。[证据](evidence.json)、[来源](source.json)、[入口](share.json)。原两种亲缘组必须合并后才能拆分训练；本次没有新增训练样本、数值质量分或真人录制。
