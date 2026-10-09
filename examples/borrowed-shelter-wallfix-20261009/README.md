# 按钮依附修正版（2026-10-09）

[开始试玩](http://127.0.0.1:4190/game/?map=FcGxDYNAEATA3ds3IkBygFzQHznRn2jAdZBRCsmV4lKcOLZkJMOM-l43PEV23XC_wAwqpkIUGioLXFKFbMrcY87lvX_b72iPOLU8rbF8Xrke4blFBEardFY4nBMcTucf)

原版 B 按钮指向空通路，违反必须依附墙面的规则。本次将它改为依附同格已有的上墙，四个按钮的位置和墙体布局未改。原版已撤回。

本次直接从原图修正按钮朝向，再重新求解、复核六项机制关系、检查分享码，并用真实浏览器方向键无伤通关。生成管线已加入墙面依附检查，拆墙、换门或扩展邻格造成按钮悬空的候选会被拒绝。

24 格、单层、两鬼、两钥匙、四按钮，默认体力 100，无玻璃及单向门。通关会自动保存当前保留分支。下一步根据你的试玩反馈复盘难度和突破点。

重启本次试玩服务：

```text
node examples/borrowed-shelter-wallfix-20261009/serve.mjs
```

<details>
<summary>剧透：修正、证书与证据边界</summary>

B 站为 `(1,4)`，朝向从左改上，依附 `hWalls[4][1]` 的实墙；证书第 17、46 次动作相应改为上。最短仍为 59 次成功动作，其中 53 次移动、6 次按钮，剩余体力 47，按钮词为 `CABCAB`。

改朝向也开放了原来被按钮拦截的左移，因此不能宣称全部策略恒等。原引擎 BFS 与快 A* 已重新证明最短长度及六项受限无解；选中证书与旧证书重映射后的物理和探索状态逐步一致。反序鬼数组仍胜利，去终点后仍安全。

- [最终地图](map.json)、[独立验证证据](evidence.json)、[直觉计划与逐格作用](strategy-review.json)。
- [浏览器验收](browser-qa.json)、[正式分享码](share.json)、[可核对的完整轨迹](browser-trace.json)。
- [错误原因与修正范围](../../docs/button-attachment-fix-20261009.md)。
- [原生成过程与旧版对照](../../docs/borrowed-shelter-selection-20261009.md)：仅作为历史来源，旧版局部精简和逐门消融未转移到修正版。

全仓 129 项测试通过；独立浏览器 59 次方向键与 60 个物理及探索状态一致，录制经原引擎另行核验。正式码 128 字符，参考码 130，压缩前 106 字节相同；一次本地初态核对约 173ms，不作为公网或冷缓存保证。

`humanQuality:null`、`dual-loop-relay-v1` 保持；没有训练模型，也未证明迷雾知识策略。构建和审查产物已排他保存，请勿重跑脚本覆盖；复核可直接读取地图、条件和证书。QA 只写 `runs/borrowed-shelter-wallfix-20261009/qa-recordings`。

</details>
