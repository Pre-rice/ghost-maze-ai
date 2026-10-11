import { installBrowserEnv } from '../../../ghost-maze/test/helpers/browser-env.mjs';
installBrowserEnv();
// 搜索、证书、训练数据与网页共同使用本体；锁文件核验这份规则的内容。
export { GameLogic } from '../../../ghost-maze/src/core/gameLogic.js';
export { MapDefinition } from '../../../ghost-maze/src/core/mapDefinition.js';
export { DataSerializer } from '../../../ghost-maze/src/core/dataSerializer.js';
export { ReplaySerializer } from '../../../ghost-maze/src/core/replaySerializer.js';
export { ActionHistory, replayStep } from '../../../ghost-maze/src/core/actionHistory.js';
export { WALL_TYPES, MAP_SIZE_MIN, MAP_SIZE_MAX } from '../../../ghost-maze/src/core/constants.js';
export { generateFullMaze } from '../../../ghost-maze/src/core/mazeGenerator.js';
export { normalizeMapData, normalizeVoidWalls, validateMapData } from '../../../ghost-maze/src/core/mapDataUtils.js';
export { actionFromName, actionToName } from '../../../ghost-maze/src/core/actions.js';
export { isValidButtonAttachment, getButtonHotspotAtPos } from '../../../ghost-maze/src/core/pathfinding.js';
