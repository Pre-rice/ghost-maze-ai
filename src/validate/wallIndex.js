import { WALL_TYPES } from '../reference/engine.js';

/**
 * wallIndex 模块 - 统一的墙索引 / 取墙 / 通行判定助手
 *
 * 消除 pathfinding.js / gameLogic.js / mazeGenerator.js 三处取墙与判定不一致的问题。
 * AI 生成管线（验证器/求解器/模拟器）的新增代码一律使用本模块。
 *
 * 墙体索引约定（与游戏一致）：
 * - hWalls: (height+1) 行 × width 列；hWalls[y][x] = 格子 (x,y) 上方的墙，hWalls[y+1][x] = 其下方的墙
 * - vWalls: height 行 × (width+1) 列；vWalls[y][x] = 格子 (x,y) 左侧的墙，vWalls[y][x+1] = 其右侧的墙
 */

/** 四方向（上右下左） */
export const DIRS4 = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
];

/**
 * 取格子 (x,y) 朝 (dx,dy) 方向的静态墙对象
 * @param {number} x - 当前格 x
 * @param {number} y - 当前格 y
 * @param {number} dx - 方向 x 分量 (-1,0,1)
 * @param {number} dy - 方向 y 分量 (-1,0,1)
 * @param {Array} hWalls - 横墙二维数组
 * @param {Array} vWalls - 竖墙二维数组
 * @returns {object|null} 墙对象或 null
 */
export function wallBetween(x, y, dx, dy, hWalls, vWalls) {
    if (dx === 1) return vWalls[y] ? vWalls[y][x + 1] : null;
    if (dx === -1) return vWalls[y] ? vWalls[y][x] : null;
    if (dy === 1) return hWalls[y + 1] ? hWalls[y + 1][x] : null;
    if (dy === -1) return hWalls[y] ? hWalls[y][x] : null;
    return null;
}

/**
 * 取格子 (x,y) 朝 (dx,dy) 方向的动态墙对象（wallStates）
 * @param {object} wallStates - { h, v } 动态墙二维数组
 */
export function wallStateBetween(x, y, dx, dy, wallStates) {
    return wallBetween(x, y, dx, dy, wallStates.h, wallStates.v);
}

/**
 * 鬼能否穿过该墙（与 gameLogic._findShortestPath 判定一致）：
 * 非 EMPTY 阻挡；已开的 LETTER_DOOR 例外（可穿过）。
 * @param {object|null} wall - 动态墙对象
 * @returns {boolean} true = 可穿过
 */
export function isGhostPassable(wall) {
    if (!wall || wall.type === WALL_TYPES.EMPTY) return true;
    return wall.type === WALL_TYPES.LETTER_DOOR && wall.currentState === 'open';
}

/**
 * 鬼的视野是否被该墙阻挡（与 gameLogic._canGhostSeePlayer 判定一致）：
 * 非 EMPTY 且非 GLASS 阻挡；已开的 LETTER_DOOR 例外（可看穿）。
 * @param {object|null} wall - 动态墙对象
 * @returns {boolean} true = 阻挡视野
 */
export function isGhostVisionBlocked(wall) {
    if (!wall) return false;
    if (wall.type === WALL_TYPES.EMPTY || wall.type === WALL_TYPES.GLASS) return false;
    return !(wall.type === WALL_TYPES.LETTER_DOOR && wall.currentState === 'open');
}

/**
 * 玩家能否穿过该墙（完整复刻 gameLogic.handleMove 的墙判定）。
 * 注意：不含边界与 activeCells 检查（由调用方处理）；LOCKED 通过后的消耗动作也由调用方处理。
 * @param {object|null} wallDef - 静态墙对象（含 type/keys/direction）
 * @param {object|null} wallState - 动态墙对象（含 currentState）
 * @param {number} keys - 玩家当前钥匙数
 * @param {object} dir - {dx, dy}
 * @returns {boolean} true = 可通行
 */
export function isPlayerTraversable(wallDef, wallState, keys, dir) {
    if (!wallDef || wallDef.type === WALL_TYPES.EMPTY) return true;
    switch (wallDef.type) {
        case WALL_TYPES.SOLID:
        case WALL_TYPES.GLASS:
            return false;
        case WALL_TYPES.ONE_WAY:
            return !!wallDef.direction &&
                wallDef.direction.dx === dir.dx &&
                wallDef.direction.dy === dir.dy;
        case WALL_TYPES.LOCKED:
            return keys >= (wallDef.keys || 0);
        case WALL_TYPES.LETTER_DOOR:
            return !wallState || wallState.currentState !== 'closed';
        default:
            return true;
    }
}
