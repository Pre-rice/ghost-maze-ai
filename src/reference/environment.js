import { createHash } from 'node:crypto';
import { GameLogic, MapDefinition, WALL_TYPES as W, MAP_SIZE_MIN, MAP_SIZE_MAX } from './engine.js';
import { checkEnvironment } from '../../scripts/check-environment.mjs';

// 与固定版本编辑器的层数上限一致；不改变游戏规则。
const MAX_LAYERS = 10;
const ACTIONS = Object.freeze({
    U: Object.freeze({ type: 'MOVE', payload: Object.freeze({ dx: 0, dy: -1 }) }),
    R: Object.freeze({ type: 'MOVE', payload: Object.freeze({ dx: 1, dy: 0 }) }),
    D: Object.freeze({ type: 'MOVE', payload: Object.freeze({ dx: 0, dy: 1 }) }),
    L: Object.freeze({ type: 'MOVE', payload: Object.freeze({ dx: -1, dy: 0 }) }),
    STAIR: Object.freeze({ type: 'USE_STAIR' })
});
export const ACTION_NAMES = Object.freeze(Object.keys(ACTIONS));
let verifiedRevision;

export function actionFromName(action) {
    if (typeof action !== 'string' || !Object.hasOwn(ACTIONS, action)) throw new TypeError(`非法动作：${String(action)}；仅允许 ${ACTION_NAMES.join(', ')}`);
    return ACTIONS[action];
}

function requireMap(condition, message) {
    if (!condition) throw new TypeError(`地图无效：${message}`);
}

function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

// 只校验引擎所需结构和当前编辑器支持范围，不限制谜题必须采用哪些机关。
function definition(map) {
    requireMap(map && typeof map === 'object' && !Array.isArray(map), '需要 mapData 对象');
    for (const name of ['width', 'height']) {
        requireMap(Number.isInteger(map[name]) && map[name] >= MAP_SIZE_MIN && map[name] <= MAP_SIZE_MAX, `${name} 必须为 ${MAP_SIZE_MIN}–${MAP_SIZE_MAX} 的整数`);
    }
    const count = map.layerCount ?? 1;
    requireMap(Number.isInteger(count) && count >= 1 && count <= MAX_LAYERS, 'layerCount 必须为 1–10');
    requireMap(count === 1 || map.multiLayerMode === true, '多层地图需要 multiLayerMode');
    requireMap(map.layers == null || (Array.isArray(map.layers) && (map.layers.length === count || (count === 1 && map.layers.length === 0))), 'layers 与 layerCount 不一致');
    requireMap(count === 1 || map.layers?.length === count, '多层地图必须提供每层数据');
    for (const name of ['initialHealth', 'initialStamina']) {
        requireMap(map[name] == null || (Number.isSafeInteger(map[name]) && map[name] > 0), `${name} 必须为正整数`);
    }
    const def = new MapDefinition(map);
    requireMap(['exploration', 'death-loop'].includes(def.gameMode), '未知 gameMode');
    requireMap(['regular', 'free'].includes(def.editorMode), '未知 editorMode');
    const grid = (rows, height, width) => Array.isArray(rows) && rows.length === height && rows.every(row => Array.isArray(row) && row.length === width);
    const point = (p, li) => !!p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < def.width && p.y >= 0 && p.y < def.height && def.layers[li]?.activeCells[p.y]?.[p.x] === true;
    const direction = d => !!d && Number.isInteger(d.dx) && Number.isInteger(d.dy) && Math.abs(d.dx) + Math.abs(d.dy) === 1;
    const letter = s => typeof s === 'string' && /^[A-Za-z]$/.test(s);
    def.layers.forEach((layer, li) => {
        requireMap(grid(layer.activeCells, def.height, def.width) && layer.activeCells.flat().every(v => typeof v === 'boolean'), `第 ${li} 层 activeCells 非法`);
        requireMap(grid(layer.initialWalls.h, def.height + 1, def.width) && grid(layer.initialWalls.v, def.height, def.width + 1), `第 ${li} 层墙数组维度非法`);
        for (const wall of [...layer.initialWalls.h.flat(), ...layer.initialWalls.v.flat()]) {
            requireMap(wall && Object.values(W).includes(wall.type), `第 ${li} 层墙类型非法`);
            if (wall.type === W.LOCKED) requireMap(Number.isSafeInteger(wall.keys ?? 0) && (wall.keys ?? 0) >= 0, '数字门门槛必须为非负整数');
            if (wall.type === W.ONE_WAY) requireMap(direction(wall.direction), '单向门方向非法');
            if (wall.type === W.LETTER_DOOR) {
                requireMap(letter(wall.letter), '字母门需要单个英文字母');
                requireMap(wall.initialState == null || ['open', 'closed'].includes(wall.initialState), '字母门初态非法');
            }
        }
        const entities = layer.initialEntities;
        for (const name of ['ghosts', 'items', 'buttons']) {
            requireMap(Array.isArray(entities[name]) && entities[name].every(p => point(p, li)), `第 ${li} 层 ${name} 位置或数组非法`);
        }
        requireMap(entities.items.every(item => item.type == null || item.type === 'key'), '当前仅支持钥匙物品');
        requireMap(entities.buttons.every(b => direction(b.direction) && letter(b.letter)), '按钮方向或字母非法');
        for (const name of ['endPos', 'customStartPos']) requireMap(entities[name] == null || point(entities[name], li), `第 ${li} 层 ${name} 非法`);
    });
    requireMap(Number.isInteger(def.playerStart.layer) && point(def.playerStart, def.playerStart.layer), '出生点不在活动格内');
    requireMap(Array.isArray(def.stairs), 'stairs 必须为数组');
    const stairCells = new Set();
    for (const stair of def.stairs) {
        requireMap(def.multiLayerMode && Number.isInteger(stair.layer) && point(stair, stair.layer), '楼梯层或位置非法');
        requireMap(['up', 'down'].includes(stair.direction), '楼梯方向非法');
        const key = `${stair.layer},${stair.x},${stair.y}`;
        requireMap(!stairCells.has(key), '同层同格不能放置多个楼梯');
        stairCells.add(key);
        const target = stair.layer + (stair.direction === 'up' ? 1 : -1);
        requireMap(def.stairs.some(other => other.x === stair.x && other.y === stair.y && other.layer === target && other.direction === (stair.direction === 'up' ? 'down' : 'up')), '楼梯缺少反向配对');
    }
    return freeze(def);
}

/**
 * 全信息、无复活的物理参考环境。状态键只在固定地图内使用，不能用于迷雾信念状态去重。
 * 保留物品和鬼的顺序；省略视觉轨迹、已见区域、计步和复活历史。
 */
export function createReferenceEnvironment(mapData) {
    verifiedRevision ??= checkEnvironment().revision;
    const mapDefinition = definition(mapData);
    const mapId = createHash('sha256').update(JSON.stringify(mapDefinition)).digest('hex');
    const initialState = () => GameLogic.createInitialState(mapDefinition);
    const step = (state, action) => {
        return GameLogic.calculateNextState(state, actionFromName(action), mapDefinition);
    };
    const stateKey = state => {
        const p = state.player;
        return JSON.stringify([
            mapId, p.layer, p.x, p.y, p.hp, p.stamina, p.keys, state.isDead, state.isWon,
            state.layerStates.map(layer => [
                layer.ghosts.map(g => [g.x, g.y]),
                layer.items.map(item => [item.x, item.y, item.type]),
                layer.wallStates
            ])
        ]);
    };
    const replay = actions => {
        if (!Array.isArray(actions)) throw new TypeError('证书 actions 必须为动作名称数组');
        let state = initialState();
        for (const action of actions) {
            if (state.isDead || state.isWon) throw new Error('证书包含终止状态后的动作');
            const next = step(state, action);
            if (next === state) throw new Error('证书包含无效动作');
            if (next.isDead) throw new Error('证书重放时死亡');
            state = next;
        }
        return { state, totalActions: actions.length, movementCost: state.player.steps };
    };
    return Object.freeze({ mapDefinition, mapId, ruleset: verifiedRevision, actions: ACTION_NAMES, initialState, step, stateKey, replay });
}
