# 回环

> 历史作品说明（2026-10-11）：下文保留原地图、反馈与当时验收证据。旧分享码、体力与独立回放地址已弃用；最新有效试玩和同页回放统一见[AI 地图总目录](https://github.com/Pre-rice/ghost-maze/blob/main/docs/ai-map-catalog.md)。不从旧证据自动推断当前最短性，冲突／非法图在总目录明确列出。

[开始试玩](http://127.0.0.1:4192/game/?map=FYsxDkBAFAXf38_aTuUIGrfYVdGI8G7gHA70j6JXO4VCIbGmmWSS0RC0xKYivqoz3kMdtACcZKk4RCmQcu3Ndg7nyJbNyp-Zy83psPfhdJmRnZnVUVxEkj5PSSI-)

[参考解法回放（剧透）](http://127.0.0.1:4193/replay.html?id=bcc6611f-ba95-4a27-966f-1db28ebc155d&autoplay=1&vision=full)：打开后自动播放并显示全图，可暂停、拖动进度和逐步看玩家、鬼与门的变化。

单层、23 个活动格，默认体力 100。没有玻璃，三个按钮均依附墙面。

这次先提出“当前安全安排会妨碍后续任务”的矛盾，再做结构提案和有限编辑搜索。淘汰了新增部分只带来独立追逐的图；最后一轮 5500 个提案中选出一张母图，作 60 个结构变体，再从 27 格精简到 23 格。原引擎与真实浏览器均已无伤通关，五项机制关系经独立复核。是否达到你要的巧妙程度，等待实际试玩反馈。

过程和筛选细节包含剧透，建议玩后再读：[按机制关系筛选](../../docs/archive/selection/shelter-exchange-selection-20261010.md)。

正式分享码 124 字符，保存在 [share.json](share.json)。一次本地初态核对约 110ms，不代表公网或冷缓存加载保证。试玩录制自动保存真实保留分支；QA 录制仅在独立 `runs/shelter-exchange-20261010/qa-recordings`，旧局保留。

## 开发记录

地图、源图、谱系和证书已经排他保存，不重跑构建覆盖：

- [map.json](map.json)：最终地图。
- [source.json](source.json)：选中的结构母图及手工变体来源。
- [manifest.json](manifest.json)：地图标识、规则版本、来源与数据拆分组。
- [evidence.json](evidence.json)：最短证书、五项关系、精简链与证明边界，包含剧透。
- [strategy-review.json](strategy-review.json)：三条人工常规计划和逐格用途，包含剧透。
- [browser-qa.json](browser-qa.json)：真实按键、状态比对、录制重放及分享码验证。

正式服务：`node examples/shelter-exchange-20261010/serve.mjs`，端口 4192。独立 QA 加 `--qa`，端口 4193。页面使用同级本体修复，规则仍由固定引擎锁决定，子模块未修改。

参考回放复用独立验收保存的无伤证书，来源信息见 [replay-entry.json](replay-entry.json)。如重启后回放无法访问，运行上面的服务命令并加 `--qa`。它不写入真人解法目录，也不改变试玩中的旧局。自动播放和全图已检查，71 个回放状态与原引擎证书一致。

全仓 129 项测试、引擎版本检查与旧种子重放通过。`humanQuality:null`，仍归 `dual-loop-relay-v1` 拆分组，没有启动训练。

下一步分析真实卡点和走位，判断这次是否需要重新理解安全安排，还是仍可局部试探后顺手完成。
