# 2026-10-07：两张精简单层候选

两张各 10 个活动格，使用不同的机制组合。已验证可解并逐项精简；2026-10-08 用户已试玩，评价“都还可以”，没有给出两题之间的偏好。

产生过程：从固定种子探索的提案中按机制筛选，逐项删格、删实体和简化墙体，直到在保留条件内局部不可再简化，再经独立求解、分享码往返和浏览器无伤通关验证。

两题的玻璃依赖作为历史样本保留。后续暂不围绕玻璃设计，新题须保证玻璃换成实心墙后策略完全不变；玻璃追踪规则的可能调整暂缓权衡，详见 [本轮反馈与约束](../../docs/status.md)。

- [试玩单元 01](http://127.0.0.1:4178/game/?map=Y-bgYGZlSGFmZGJikJPjYWBgYGBkYmRkZmZYtWrVqimrulYhg_5Vq7tWTQ2FgQBGRgA)：一只鬼、一把钥匙。
- [试玩单元 02](http://127.0.0.1:4178/game/?map=Y-bgYGZlSGFmZWJiYGBj4-NjYGBiZmFiZWBYBQZdq7RWflqFAKtDQ7VWdQGFQaCBAQA)：两只鬼，没有钥匙或按钮。

游戏页含录制器，通关后自动保存。可以撤回或重试；请先自己玩，再看下面的分析。服务未启动时，在本仓库运行 `npm run review`。

<details>
<summary>备用分享码</summary>

单元 01：

```text
Y-bgYGZlSGFmZGJikJPjYWBgYGBkYmRkZmZYtWrVqimrulYhg_5Vq7tWTQ2FgQBGRgA
```

单元 02：

```text
Y-bgYGZlSGFmZWJiYGBj4-NjYGBiZmFiZWBYBQZdq7RWflqFAKtDQ7VWdQGFQaCBAQA
```

</details>

<details>
<summary>内部设计分析、解法与精简边界（剧透）</summary>

见 [design.md](design.md)。两题最短分别 18、14 次动作，均没有按钮回合或刻意收紧体力。

地图与证据： [unit-01.json](unit-01.json)、[unit-01-evidence.json](unit-01-evidence.json)、[unit-02.json](unit-02.json)、[unit-02-evidence.json](unit-02-evidence.json)。

复建命令：`node examples/minimal-units-20261007/build.mjs`。此命令重写本目录脚本生成的 unit 与证据文件；请将自己的改图另存，不覆盖这些基线。

</details>
