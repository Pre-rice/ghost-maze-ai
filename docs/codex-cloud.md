# AI 运行与私人资料

本文件只说明 AI 开发、谜题设计与资料维护环境。工作职责、命令和验收纪律见[AGENTS](../AGENTS.md)，当前任务及停点只看[status](status.md)。

## 环境与引擎

Node.js 22（已验收 22.21.1）、Python 3；本仓 `npm ci`。将 `ghost-maze-ai` 与唯一规则源 `ghost-maze` 放在同级目录。开工核对本仓 main；使用引擎前核对其提交、未提交修改及 `engine.lock.json`，不覆盖任一仓已有工作。

`npm run check` 核验运行环境与规则内容锁，`npm run verify:seeds` 核对两个原种子；统一 `npm run cloud:check` 检查本仓、引擎及集成入口。不改锁掩盖漂移，不写入真人反馈。vendor 是历史副本，不作运行规则源。

研究工具需要 HTTP 时，`npm run cloud:serve -- 4206` 启动现有本地集成服务；API 与规则适配只用于研究／核验，不作为独立的游戏规则实现。配置公开代理时使用环境提供的真实地址，不把 localhost 当交付入口。

## 私人资料

源码、公开评述摘要与证据通过 Git 保存；完整真人录制、未跟踪反馈、迁移资料及 runs 通过私人快照保存，不公开上传私人原件。Git 提交不能代替这些资料备份。

恢复已有资料包：

```sh
python3 scripts/restore-cloud-data.py <实际资料包路径>
```

逐文件 SHA-256 核对，已有不同内容拒绝覆盖。新任务检查实际文件；环境保存不等于资料已经恢复或代码已经提交。

若当前清单的`archiveKind`为`supplement_to_full_snapshot`，它只是新增原件的小包。先按清单的`baseSnapshot`恢复完整包，再恢复所列补充包；不要只拿序号最大的补充包当作完整资料。仍使用同一恢复命令，最新完整包及补充关系只在status维护。

新增私人资料后导出新名：

```sh
python3 scripts/export-cloud-data.py artifacts/cloud-data-新日期或序号.zip
```

导出会生成清单并检查 ZIP；保留全部旧包与原件，不覆盖、拼接或补写真人轨迹。按实际可用渠道交付；只存在云端的包不能称为用户已下载。

旧按钮时机分支、Git bundle 与迁移原件在 archives/cloud-migration；旧 LLM 资料在 docs/archive。历史接手全文见[旧快照](archive/worklogs/codex-cloud-before-reorganization-20261013.md)，不能作为当前任务。最新私人快照及校验来源见 status 所链接的反馈／研究清单。
