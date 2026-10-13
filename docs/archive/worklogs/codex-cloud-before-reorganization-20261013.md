> 历史资料：保留整理前的判断与过程，不代表当前任务或状态。现行入口见[文档索引](../../README.md)。

# Codex 云端开发

2026-10-13 当前交付约定：地图与参考回放必须使用 `https://ghostmaze.novic.cc/`，Sites 仅用于站点改动预览。用户自行访问，不自动打开侧边页面；只确认 GitHub 推送结果，不检查正式站或部署状态。旧记录中的云端／Sites 地图链接属于历史证据，不再用于新交付。


更新：2026-10-11。本体与 AI 工具同时迁移，保持同级 `ghost-maze/` 与 `ghost-maze-ai/`，默认以两仓 `main` 为基线。

用户操作、可复制的环境准备与首次任务指令集中在[本体云端交接](https://github.com/Pre-rice/ghost-maze/blob/main/docs/codex-cloud.md)，避免维护两份不同方案。

- Node.js 22.21.1、Python 3；`npm ci`，不新增项目依赖。
- 私下上传 `cloud-data.zip`，运行 `python3 scripts/restore-cloud-data.py <资料包路径>`，逐文件核对且不覆盖不同内容。
- 新增私人资料后用 `python3 scripts/export-cloud-data.py artifacts/cloud-data-日期.zip` 导出新包并提供下载；新任务恢复最新包或重新发布环境，不覆盖旧包。
- `npm run cloud:check`：本体、AI、共同规则锁、原种子和 HTTP 入口一并核验。
- `npm run cloud:serve -- 4206`：启动共用本体的游玩／编辑入口与后台研究留档。需要云端预览代理时设置 `GHOST_MAZE_HOST=0.0.0.0`，将 `GHOST_MAZE_ORIGIN` 设置为真实预览地址的协议和主机。
- 完整真人录制、未跟踪反馈、迁移结果与研究输出通过私人资料包恢复；已有历史和文档中的反馈摘要继续保留，公开范围见本体交接。新增资料也要导出。
- 历史按钮时机分支与所有既有 Git 分支在资料包档案内保留，不作为当前规则或训练质量证明。
- 本次准备已完成，两仓 main 已获批推送，线上游戏已同步更新；真实云端环境待用户创建。迁移不启动训练或生成新题。旧 Codex stall／guard 本机诊断不进入云端代码或运行流程，原件完整保留在本地备份。
