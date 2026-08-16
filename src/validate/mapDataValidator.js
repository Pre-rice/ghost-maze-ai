import { WALL_TYPES } from '../engine/constants.js';

/**
 * mapDataValidator - mapData 结构合法性校验器
 *
 * 验证层第 ① 道硬门：形状/边界/实体合法性。任何一条不通过 → 地图直接淘汰。
 * 语义与 src/validate/simulator.js 的 normalizeMapData 及游戏侧 gameLogic 消费方式保持一致
 * （墙索引约定：hWalls[y][x] = 格 (x,y) 上方的墙；vWalls[y][x] = 格 (x,y) 左侧的墙）。
 *
 * @param {object} mapData - 待校验的地图数据
 * @param {object} opts - { stage1Only: boolean } 默认 true。
 *   阶段一约束：仅允许 EMPTY/SOLID/DOOR/LOCKED 四种墙 + 钥匙 + 鬼 + 终点，
 *   禁止 ONE_WAY/GLASS/LETTER_DOOR/按钮/楼梯/多层。该开关供后续阶段扩展用。
 * @returns {{ valid: boolean, errors: string[] }}
 */

const STAGE1_WALL_TYPES = new Set([
    WALL_TYPES.EMPTY,
    WALL_TYPES.SOLID,
    WALL_TYPES.DOOR,
    WALL_TYPES.LOCKED
]);

const VALID_WALL_TYPES = new Set(Object.values(WALL_TYPES));
const VALID_GAME_MODES = new Set(['exploration', 'death-loop']);

function isInt(v) { return Number.isInteger(v); }
function inBounds(x, y, w, h) { return isInt(x) && isInt(y) && x >= 0 && y >= 0 && x < w && y < h; }
function isActiveCell(activeCells, x, y, w, h) {
    return activeCells == null || activeCells[y] == null || activeCells[y][x] !== false;
}
function isUnitDir(d) { return !!d && isInt(d.dx) && isInt(d.dy) && Math.abs(d.dx) + Math.abs(d.dy) === 1; }

export function validateMapData(mapData, opts = {}) {
    const stage1Only = opts.stage1Only !== false;
    const errors = [];
    const push = msg => errors.push(msg);

    if (!mapData || typeof mapData !== 'object') {
        return { valid: false, errors: ['mapData 不是对象'] };
    }

    // ── 尺寸 ──────────────────────────────────────────────
    const { width, height } = mapData;
    if (!isInt(width) || !isInt(height) || width < 8 || width > 20 || height < 8 || height > 20) {
        push(`尺寸非法：width=${width}, height=${height}（要求整数 8–20）`);
    }

    // ── 模式 ──────────────────────────────────────────────
    if (mapData.gameMode != null && !VALID_GAME_MODES.has(mapData.gameMode)) {
        push(`gameMode 非法：${mapData.gameMode}（仅 exploration / death-loop）`);
    }
    if (mapData.editorMode != null && mapData.editorMode !== 'regular' && mapData.editorMode !== 'free') {
        push(`editorMode 非法：${mapData.editorMode}（仅 regular / free）`);
    }
    if (stage1Only && mapData.multiLayerMode) {
        push('阶段一禁止多层地图（multiLayerMode 必须为 false/缺省）');
    }
    if (stage1Only && mapData.layers && mapData.layers.length > 1) {
        push('阶段一禁止多层地图（layers 只允许 0/1 层）');
    }
    if (mapData.gameMode === 'death-loop' && !(mapData.initialStamina > 0)) {
        push('death-loop 模式必须提供正整数 initialStamina');
    }

    if (width == null || height == null) return { valid: false, errors }; // 后续校验依赖尺寸

    // ── 墙体数组维度与内容 ─────────────────────────────────
    const hWalls = mapData.hWalls;
    const vWalls = mapData.vWalls;
    if (!Array.isArray(hWalls) || hWalls.length !== height + 1 || !hWalls.every(r => Array.isArray(r) && r.length === width)) {
        push(`hWalls 维度非法：要求 (height+1)×width = ${height + 1}×${width}`);
    }
    if (!Array.isArray(vWalls) || vWalls.length !== height || !vWalls.every(r => Array.isArray(r) && r.length === width + 1)) {
        push(`vWalls 维度非法：要求 height×(width+1) = ${height}×${width + 1}`);
    }

    const checkWall = (wall, where) => {
        if (wall == null) return; // 缺省视为 EMPTY
        const type = wall.type;
        if (!VALID_WALL_TYPES.has(type)) {
            push(`${where} 墙类型非法：${type}`);
            return;
        }
        if (stage1Only && !STAGE1_WALL_TYPES.has(type)) {
            push(`${where} 阶段一禁止墙类型：${type}`);
            return;
        }
        if (type === WALL_TYPES.LOCKED && !(isInt(wall.keys) && wall.keys >= 1)) {
            push(`${where} LOCKED 门必须带正整数 keys（实际 ${wall.keys}）`);
        }
        if (type === WALL_TYPES.ONE_WAY && !isUnitDir(wall.direction)) {
            push(`${where} ONE_WAY 门必须带单位方向 direction`);
        }
        if (type === WALL_TYPES.LETTER_DOOR && typeof wall.letter !== 'string') {
            push(`${where} LETTER_DOOR 必须带 letter`);
        }
    };

    if (Array.isArray(hWalls)) {
        for (let y = 0; y <= height; y++) {
            for (let x = 0; x < width; x++) checkWall(hWalls[y]?.[x], `hWalls[${y}][${x}]`);
        }
    }
    if (Array.isArray(vWalls)) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x <= width; x++) checkWall(vWalls[y]?.[x], `vWalls[${y}][${x}]`);
        }
    }

    // ── activeCells ───────────────────────────────────────
    const activeCells = mapData.activeCells;
    if (activeCells != null) {
        if (!Array.isArray(activeCells) || activeCells.length !== height || !activeCells.every(r => Array.isArray(r) && r.length === width)) {
            push(`activeCells 维度非法：要求 height×width = ${height}×${width}`);
        }
    }

    // ── 起点 / 终点 ───────────────────────────────────────
    const startPos = mapData.startPos || { x: 1, y: height - 2 };
    if (!inBounds(startPos.x, startPos.y, width, height)) {
        push(`startPos 越界：(${startPos.x}, ${startPos.y})`);
    } else if (!isActiveCell(activeCells, startPos.x, startPos.y, width, height)) {
        push(`startPos 不在 active 格内：(${startPos.x}, ${startPos.y})`);
    }

    const endPos = mapData.endPos;
    if (!endPos) {
        push('缺少 endPos');
    } else if (!inBounds(endPos.x, endPos.y, width, height)) {
        push(`endPos 越界：(${endPos.x}, ${endPos.y})`);
    } else if (!isActiveCell(activeCells, endPos.x, endPos.y, width, height)) {
        push(`endPos 不在 active 格内：(${endPos.x}, ${endPos.y})`);
    }

    // ── 实体：钥匙 / 鬼 / 按钮 / 楼梯 ─────────────────────
    const checkEntity = (e, name, needType) => {
        if (!e || typeof e !== 'object') { push(`${name} 实体非法`); return; }
        if (!inBounds(e.x, e.y, width, height)) {
            push(`${name} 越界：(${e.x}, ${e.y})`);
        } else if (!isActiveCell(activeCells, e.x, e.y, width, height)) {
            push(`${name} 不在 active 格内：(${e.x}, ${e.y})`);
        }
        if (needType && e.type !== 'key') push(`${name} type 必须为 'key'（实际 ${e.type}）`);
    };

    (mapData.items || []).forEach((it, i) => checkEntity(it, `items[${i}]`, true));
    (mapData.initialGhosts || []).forEach((g, i) => checkEntity(g, `initialGhosts[${i}]`, false));
    (mapData.buttons || []).forEach((b, i) => {
        if (stage1Only) { push(`阶段一禁止按钮（buttons[${i}]）`); return; }
        checkEntity(b, `buttons[${i}]`, false);
        if (!isUnitDir(b.direction)) push(`buttons[${i}] direction 非法`);
        if (typeof b.letter !== 'string') push(`buttons[${i}] 缺 letter`);
    });
    (mapData.stairs || []).forEach((s, i) => {
        if (stage1Only) { push(`阶段一禁止楼梯（stairs[${i}]）`); return; }
        if (!inBounds(s.x, s.y, width, height)) push(`stairs[${i}] 越界`);
        if (s.direction !== 'up' && s.direction !== 'down') push(`stairs[${i}] direction 非法`);
    });

    return { valid: errors.length === 0, errors };
}
