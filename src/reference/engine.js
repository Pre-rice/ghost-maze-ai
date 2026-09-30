import { installBrowserEnv } from '../../vendor/ghost-maze/test/helpers/browser-env.mjs';

// 只补齐分享码所需的 Node 环境；规则直接复用固定版本游戏仓库。
installBrowserEnv();

export { GameLogic } from '../../vendor/ghost-maze/src/core/gameLogic.js';
export { MapDefinition } from '../../vendor/ghost-maze/src/core/mapDefinition.js';
export { DataSerializer } from '../../vendor/ghost-maze/src/core/dataSerializer.js';
export { WALL_TYPES, MAP_SIZE_MIN, MAP_SIZE_MAX } from '../../vendor/ghost-maze/src/core/constants.js';
export { generateFullMaze } from '../../vendor/ghost-maze/src/core/mazeGenerator.js';
