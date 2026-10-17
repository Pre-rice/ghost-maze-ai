# 《调度》· 当前规则验收

2026-10-18。地图仍是原25格、三鬼、六扇字母门与四按钮；只修正本体的关门当步追击。最优70步、四种含停顿的鬼轨迹，全部无非致死重合，去终点安全；中性开局、指定实际入场、编号/排列及分享往返通过。

用户实际试玩评价：“新版《调度》甚至更妙了！”“需要更复杂的调度才能实现把鬼引到合适位置。”“核心思想几乎完全不变！”明确要求加入地图集，作为当前第十五张追加。此为新版自己的真实肯定，不从旧版继承。

[试玩](https://ghostmaze.novic.cc/?map=AADAAPj4-Pj4AAEyYFCMkDVATgEBuhAFVBcg4AAFcCqgAAAAnCFTkLhQooQQAAAECEGAAA)

<details><summary>设计说明与当前参考（含答案）</summary>

玩家需要从不同方向诱导鬼、临时进入并退出控制区域，逐步形成可到达终点的局面。新版还会把鬼引到外圈；内外位置变化服务于整体调度。不能把“鬼始终留在内圈”当作核心本身。用户确认的核心是调度形成合适态势，而非仅靠门旁按钮逐只困鬼。

[70步参考](https://ghostmaze.novic.cc/?map=AADAAPj4-Pj4AAEyYFCMkDVATgEBuhAFVBcg4AAFcCqgAAAAnCFTkLhQooQQAAAECEGAAA&replay=EHN-Avgo9yn8opZf3Asp1XAKD3KClsA)。四条代表路线均由同一原生规则独立证明最优，当前网页求解也展示四种鬼轨迹。

</details>

只读复验：`node examples/inside-shunting-20261017/current-rules-20261018/verify.mjs`。

[当前证据](evidence.json) · [当前分享与回放](share.json) · [真实评述及判断修正](../../../data/manifests/inside-shunting-current-review-20261018.json)。[原始地图](../map.json)、[生成时来源](../source.json)、[旧规则50步证据](../evidence.json)保持；旧50步回放不用于当前规则。
