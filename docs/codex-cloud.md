# Codex 云端开发

更新：2026-10-11。本体与 AI 工具同时迁移，保持同级 `ghost-maze/` 与 `ghost-maze-ai/`，默认以两仓 `main` 为基线。

用户操作、可复制的环境准备与首次任务指令集中在[本体云端交接](../../ghost-maze/docs/codex-cloud.md)，避免维护两份不同方案。

- Node.js 22.21.1、Python 3；`npm ci`，不新增项目依赖。
- 私下上传 `cloud-data.zip`，运行 `python3 scripts/restore-cloud-data.py <资料包路径>`，逐文件核对且不覆盖不同内容。
- `npm run cloud:check`：本体、AI、共同规则锁、原种子和 HTTP 入口一并核验。
- `npm run cloud:serve -- 4206`：启动共用本体的游玩／编辑入口与后台研究留档。需要云端预览代理时设置 `GHOST_MAZE_HOST=0.0.0.0`，将 `GHOST_MAZE_ORIGIN` 设置为真实预览地址的协议和主机。
- 完整真人录制、未跟踪反馈、迁移结果与研究输出通过私人资料包恢复；已有历史和文档中的反馈摘要继续保留，公开范围见本体交接。新增资料也要导出。
- 历史按钮时机分支与所有既有 Git 分支在资料包档案内保留，不作为当前规则或训练质量证明。
- 本次迁移不训练、不生成新题，不更新线上游戏。旧 Codex stall／guard 本机诊断不进入云端代码或运行流程，原件完整保留在本地备份。
