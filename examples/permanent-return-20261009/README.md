# 新单层组合候选

[开始试玩](http://127.0.0.1:4186/game/?map=FcahDYBADEbh_u1BUCSM1EoUguYkhpXQBIGgDMEkSJZAwX3PPGkaqWgGoa5TWxAzSYIkAbMisQmLRuw-xfHGuuQ1Ni_6iDhvz49Pl49_7kOnUDKQEcP-MXw)

18 个活动格，单层、两只鬼、三个按钮，使用 A/B、单向门与一把钥匙；默认体力 100，完全无玻璃。可以打开已有的“调试视野”先看完整布局。

产生过程：手工提出五个结构，另试三个侧向变体；先淘汰开门即可直达、或能绕圈跳过整组机关的方案。对留下的结构检查操作是否为下一阶段准备条件，再逐门对照，删除一扇下侧 A 门的属性，将右上 A 门改为实墙。没有使用训练模型或大规模随机搜索。

关系筛选重点检查：先解除一处危险是否足以继续，机关改变通路后能否返回，保护完成后是否还要换站操作。三条指定直觉路线已实际重放失败，关键关系由完整搜索复核；这些结果仍不能替代你的试玩判断。

原引擎、分享码与浏览器真实按键逐状态一致，无伤自动录制通过。试玩入口使用本体补角修复和本地压缩版本，分享码为 119 字符；本次本地导航约 240ms 完成初态检查，尚不能据此保证公网加载速度。玻璃替换后完整地图恒等，全部策略不变；迷雾知识策略未证明，精妙程度待真实试玩。

如服务需要重新启动，在 AI 仓库运行：

```powershell
node examples/permanent-return-20261009/serve.mjs
```

<details>
<summary>详细机制筛选、设计与解法（剧透）</summary>

见 [本轮关系筛选](../../docs/permanent-return-selection-20261009.md)、[逐阶段解法](design.md)、[原引擎证据](evidence.json)、[直觉路线审查](strategy-review.json)、[浏览器核验](browser-qa.json)、[正式分享码](share.json)。

</details>

下一步根据你的卡点和实际解法复盘，判断准备与交接是否产生了突破体验，或仍可顺手试出。
