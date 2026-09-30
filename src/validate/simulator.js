import { WALL_TYPES, MapDefinition } from '../reference/engine.js';
import { DIRS4, wallStateBetween, isGhostPassable, isGhostVisionBlocked, isPlayerTraversable } from './wallIndex.js';

/**
 * simulator 模块 - 与权威引擎对照的紧凑物理模拟器
 *
 * 轻量确定性状态机，对齐固定 gameLogic 的物理规则：
 * 移动/按钮副作用/拾取/鬼 AI（视野追捕+冲突解决）/碰撞/胜负/death-loop 语义。
 * 与 gameLogic 的差异（均为有意为之）：
 * - 去除 trail/seenCells 等非确定性/无关字段（trail 用 Date.now()，破坏搜索去重）
 * - 状态紧凑可哈希（stateKey），支持 A* 寻路与 BFS 去重
 * - 稀疏 COW：墙对象替换式更新，克隆只浅拷贝受影响行
 * - 支持 withGhosts:false 开关（结构级搜索用，跳过鬼移动与碰撞）
 *
 * 验证器（solvabilityVerifier）与求解器（solver）都构建在本模块之上，
 * 固定版本原引擎才是权威；本实现必须通过逐状态差分和证书重放。
 */

// ==================================================
// 数据规范化
// ==================================================

/**
 * 把 mapData（generateFullMaze 返回形状）规范化为模拟器内部结构
 */
function normalizeMapData(mapData) {
    const def = mapData instanceof MapDefinition ? mapData : new MapDefinition(mapData);
    return {
        width: def.width, height: def.height, layerCount: def.layerCount,
        multiLayer: def.multiLayerMode, startPos: { ...def.playerStart },
        editorMode: def.editorMode, gameMode: def.gameMode,
        initialHealth: def.initialHealth, initialStamina: def.initialStamina,
        stairs: def.stairs,
        layers: def.layers.map(layer => ({
            hWalls: layer.initialWalls.h, vWalls: layer.initialWalls.v,
            activeCells: layer.activeCells, ...layer.initialEntities
        }))
    };
}

// ==================================================
// 模拟器构建
// ==================================================

/**
 * 构建模拟器（预计算：墙位索引、字母门索引、楼梯配对）
 * @param {object} mapData - 与 generateFullMaze 返回同构的地图数据
 * @param {object} opts - { withGhosts: boolean } 默认 true
 * @returns {object} sim 对象（不可变）
 */
export function makeSimulator(mapData, opts = {}) {
    const norm = normalizeMapData(mapData);
    const withGhosts = opts.withGhosts !== false;

    // 为动态墙分配全局位索引（wallBits）：
    // LOCKED（消耗型，通过后永久 EMPTY）与 LETTER_DOOR（开关型）需要位；
    // 其余墙（EMPTY/SOLID/DOOR/ONE_WAY/GLASS）状态不变，不占位。
    const wallBitsIdx = [];
    const letterWalls = new Map(); // letter -> [{ layer, dir, y, x, bit }]
    const lockBits = new Set(); // 已消耗 LOCKED 门的位索引（解法特征统计用）
    let bitCount = 0;

    for (let li = 0; li < norm.layerCount; li++) {
        const layer = norm.layers[li];
        const hIdx = [];
        const vIdx = [];
        const dirs = [
            { dir: 'h', rows: layer.hWalls },
            { dir: 'v', rows: layer.vWalls }
        ];
        for (const { dir, rows } of dirs) {
            const target = dir === 'h' ? hIdx : vIdx;
            if (!rows) continue;
            for (let y = 0; y < rows.length; y++) {
                const row = rows[y];
                const idxRow = [];
                if (row) {
                    for (let x = 0; x < row.length; x++) {
                        const w = row[x];
                        if (!w) { idxRow.push(-1); continue; }
                        if (w.type === WALL_TYPES.LOCKED) {
                            idxRow.push(bitCount);
                            lockBits.add(bitCount);
                            bitCount++;
                        } else if (w.type === WALL_TYPES.LETTER_DOOR) {
                            const bit = bitCount++;
                            idxRow.push(bit);
                            if (w.letter != null) {
                                if (!letterWalls.has(w.letter)) letterWalls.set(w.letter, []);
                                letterWalls.get(w.letter).push({ layer: li, dir, y, x, bit });
                            }
                        } else {
                            idxRow.push(-1);
                        }
                    }
                }
                target.push(idxRow);
            }
        }
        wallBitsIdx.push({ h: hIdx, v: vIdx });
    }

    return {
        ...norm,
        withGhosts,
        wallBitsIdx,
        letterWalls,
        lockBits,
        bitCount
    };
}

// ==================================================
// 状态创建与克隆
// ==================================================

function buildWallStates(layer) {
    const copyRow = row => row ? row.map(w => ({
        type: w.type,
        keys: w.keys || 0,
        direction: w.direction ? { ...w.direction } : null,
        letter: w.letter || null,
        initialState: w.initialState || 'closed',
        currentState: w.initialState || 'closed'
    })) : [];
    return {
        h: layer.hWalls ? layer.hWalls.map(copyRow) : [],
        v: layer.vWalls ? layer.vWalls.map(copyRow) : []
    };
}

function initialWallBits(sim) {
    let bits = 0n;
    // 初始为 open 的字母门
    for (let li = 0; li < sim.layerCount; li++) {
        const layer = sim.layers[li];
        const collect = (rows, idxRows) => {
            if (!rows) return;
            for (let y = 0; y < rows.length; y++) {
                const row = rows[y];
                if (!row) continue;
                for (let x = 0; x < row.length; x++) {
                    const w = row[x];
                    if (w && w.type === WALL_TYPES.LETTER_DOOR && w.initialState === 'open') {
                        const idx = idxRows[y] ? idxRows[y][x] : -1;
                        if (idx >= 0) bits |= (1n << BigInt(idx));
                    }
                }
            }
        };
        collect(layer.hWalls, sim.wallBitsIdx[li].h);
        collect(layer.vWalls, sim.wallBitsIdx[li].v);
    }
    return bits;
}

/**
 * 创建紧凑初始状态
 */
export function createInitState(sim) {
    return {
        player: {
            layer: sim.startPos.layer,
            x: sim.startPos.x,
            y: sim.startPos.y,
            hp: sim.initialHealth,
            stamina: sim.initialStamina,
            keys: 0,
            steps: 0
        },
        layers: sim.layers.map(layer => ({
            ghosts: layer.ghosts.map(g => ({ x: g.x, y: g.y })),
            items: layer.items.map(i => ({ x: i.x, y: i.y, type: i.type || 'key' })),
            wallStates: buildWallStates(layer)
        })),
        wallBits: initialWallBits(sim),
        loopCount: 0,
        isDead: false,
        isWon: false
    };
}

/**
 * 轻量克隆：复制实体与墙行目录，只在写入时复制具体墙行，保持前态与兄弟分支不变
 */
function cloneState(state) {
    return {
        player: { ...state.player },
        layers: state.layers.map(l => ({
            ghosts: l.ghosts.map(g => ({ ...g })),
            items: l.items.slice(),
            wallStates: {
                h: l.wallStates.h.slice(),
                v: l.wallStates.v.slice()
            }
        })),
        wallBits: state.wallBits,
        loopCount: state.loopCount,
        isDead: state.isDead,
        isWon: state.isWon
    };
}

// ==================================================
// 墙状态替换（COW 安全）
// ==================================================

/** 替换某层某方向的 (y,x) 墙对象为新对象（不污染共享引用） */
function replaceWall(state, layerIdx, dir, y, x, newWall) {
    const ws = state.layers[layerIdx].wallStates[dir];
    const row = ws[y];
    if (!row) return;
    ws[y] = row.slice();
    ws[y][x] = newWall;
}

// ==================================================
// 规则复刻（与 gameLogic 一一对应）
// ==================================================

/** 复刻 gameLogic.handlePressButton：翻转所有层所有该字母门 */
function handlePressButton(state, sim, letter) {
    const walls = sim.letterWalls.get(letter);
    if (!walls || walls.length === 0) return false;
    for (const { layer, dir, y, x, bit } of walls) {
        const ws = state.layers[layer].wallStates[dir];
        const row = ws[y];
        if (!row || !row[x]) continue;
        const w = row[x];
        const next = w.currentState === 'closed' ? 'open' : 'closed';
        if (w.currentState === next) continue;
        // COW 替换 + 位翻转
        replaceWall(state, layer, dir, y, x, { ...w, currentState: next });
        state.wallBits ^= (1n << BigInt(bit));
    }
    return true;
}

/** 复刻 gameLogic.handleMove（含按钮副作用）；返回是否发生状态变更 */
function handleMove(state, sim, action) {
    const p = state.player;
    const layerIdx = p.layer;
    const layer = sim.layers[layerIdx];
    const layerState = state.layers[layerIdx];

    // 按钮副作用：在按钮格上朝按钮方向移动即触发按钮（玩家不移动）
    const button = (layer.buttons || []).find(b =>
        b.x === p.x && b.y === p.y &&
        b.direction.dx === action.dx && b.direction.dy === action.dy
    );
    if (button) {
        return handlePressButton(state, sim, button.letter);
    }

    const nx = p.x + action.dx;
    const ny = p.y + action.dy;
    if (nx < 0 || nx >= sim.width || ny < 0 || ny >= sim.height) return false;
    if (!layer.activeCells[ny][nx]) return false;

    const wallDef = wallStateBetween(p.x, p.y, action.dx, action.dy, {
        h: layer.hWalls || [],
        v: layer.vWalls || []
    });
    const wallState = wallStateBetween(p.x, p.y, action.dx, action.dy, layerState.wallStates);

    if (!isPlayerTraversable(wallDef, wallState, p.keys, action)) return false;

    // LOCKED 消耗门：通过后置为 EMPTY（鬼也随之能穿过）
    if (wallDef && wallDef.type === WALL_TYPES.LOCKED && wallState) {
        const idx = (() => {
            if (action.dx === 1) return sim.wallBitsIdx[layerIdx].v[p.y] ? sim.wallBitsIdx[layerIdx].v[p.y][p.x + 1] : -1;
            if (action.dx === -1) return sim.wallBitsIdx[layerIdx].v[p.y] ? sim.wallBitsIdx[layerIdx].v[p.y][p.x] : -1;
            if (action.dy === 1) return sim.wallBitsIdx[layerIdx].h[p.y + 1] ? sim.wallBitsIdx[layerIdx].h[p.y + 1][p.x] : -1;
            return sim.wallBitsIdx[layerIdx].h[p.y] ? sim.wallBitsIdx[layerIdx].h[p.y][p.x] : -1;
        })();
        const dir = action.dx !== 0 ? 'v' : 'h';
        const wy = action.dy === 1 ? p.y + 1 : (action.dy === -1 ? p.y : p.y);
        const wx = action.dx === 1 ? p.x + 1 : (action.dx === -1 ? p.x : p.x);
        replaceWall(state, layerIdx, dir, wy, wx, { ...wallState, type: WALL_TYPES.EMPTY });
        if (idx >= 0) state.wallBits |= (1n << BigInt(idx));
    }

    p.x = nx;
    p.y = ny;
    p.steps++;
    if (sim.gameMode === 'death-loop') {
        p.stamina--;
    }
    return true;
}

/** 复刻 gameLogic.handleUseStair */
function handleUseStair(state, sim) {
    if (!sim.multiLayer) return false;
    const p = state.player;
    const stairs = sim.stairs;
    const stair = stairs.find(s => s.x === p.x && s.y === p.y && s.layer === p.layer);
    if (!stair) return false;

    const targetLayer = stair.direction === 'up' ? p.layer + 1 : p.layer - 1;
    if (targetLayer < 0 || targetLayer >= sim.layerCount) return false;

    const targetStair = stairs.find(s =>
        s.x === p.x && s.y === p.y && s.layer === targetLayer &&
        s.direction === (stair.direction === 'up' ? 'down' : 'up')
    );
    if (!targetStair) return false;

    p.layer = targetLayer;
    p.steps++;
    if (sim.gameMode === 'death-loop') {
        p.stamina--;
    }
    return true;
}

/** 与固定游戏引擎一致：每次成功动作只拾取脚下第一个物品。 */
function handleItemPickup(state, sim) {
    const p = state.player;
    const items = state.layers[p.layer].items;
    const index = items.findIndex(item => item.x === p.x && item.y === p.y);
    if (index >= 0) {
        if (items[index].type === 'key') p.keys++;
        items.splice(index, 1);
    }
}

/** 复刻 gameLogic._canGhostSeePlayer：同行或同列且中间无阻挡墙（playerPos 可为假想位，供逃生评分） */
export function canGhostSeePlayer(sim, state, layerIdx, ghost, playerPos) {
    if (!playerPos) return false;
    if (ghost.x !== playerPos.x && ghost.y !== playerPos.y) return false;
    const ws = state.layers[layerIdx].wallStates;

    if (ghost.x === playerPos.x) {
        const startY = Math.min(ghost.y, playerPos.y);
        const endY = Math.max(ghost.y, playerPos.y);
        for (let y = startY; y < endY; y++) {
            const w = ws.h[y + 1] ? ws.h[y + 1][ghost.x] : null;
            if (w && isGhostVisionBlocked(w)) return false;
        }
    } else {
        const startX = Math.min(ghost.x, playerPos.x);
        const endX = Math.max(ghost.x, playerPos.x);
        for (let x = startX; x < endX; x++) {
            const w = ws.v[ghost.y] ? ws.v[ghost.y][x + 1] : null;
            if (w && isGhostVisionBlocked(w)) return false;
        }
    }
    return true;
}

/** 复刻 gameLogic._findShortestPath：鬼的 BFS 寻路（走动态墙，activeCells 过滤） */
function findGhostPath(sim, layerIdx, state, start, end) {
    const layer = sim.layers[layerIdx];
    const ws = state.layers[layerIdx].wallStates;
    const width = sim.width;
    const height = sim.height;
    const queue = [{ x: start.x, y: start.y, prev: null }];
    const visited = new Set([`${start.x},${start.y}`]);

    while (queue.length > 0) {
        const cur = queue.shift();
        if (cur.x === end.x && cur.y === end.y) {
            // 回溯路径
            const path = [];
            let node = cur;
            while (node) {
                path.unshift({ x: node.x, y: node.y });
                node = node.prev;
            }
            return path;
        }
        for (const { dx, dy } of DIRS4) {
            const nx = cur.x + dx;
            const ny = cur.y + dy;
            const key = `${nx},${ny}`;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height || visited.has(key)) continue;
            if (!layer.activeCells[ny][nx]) continue;
            const wall = wallStateBetween(cur.x, cur.y, dx, dy, ws);
            if (wall && !isGhostPassable(wall)) continue;
            visited.add(key);
            queue.push({ x: nx, y: ny, prev: cur });
        }
    }
    return null;
}

/** 复刻 gameLogic._handleGhostStairChase：玩家原位置在楼梯上时，配对层同格鬼瞬移追来 */
function handleGhostStairChase(state, sim, originalPlayerPos) {
    const movedGhosts = new Set();
    if (!sim.multiLayer) return movedGhosts;
    const stairs = sim.stairs;
    const playerStair = stairs.find(s =>
        s.x === originalPlayerPos.x && s.y === originalPlayerPos.y && s.layer === originalPlayerPos.layer
    );
    if (!playerStair) return movedGhosts;

    const pairedLayer = playerStair.direction === 'up' ? originalPlayerPos.layer + 1 : originalPlayerPos.layer - 1;
    if (pairedLayer < 0 || pairedLayer >= sim.layerCount) return movedGhosts;

    const pairedStair = stairs.find(s =>
        s.x === originalPlayerPos.x && s.y === originalPlayerPos.y &&
        s.layer === pairedLayer &&
        s.direction === (playerStair.direction === 'up' ? 'down' : 'up')
    );
    if (!pairedStair) return movedGhosts;

    const pairedGhosts = state.layers[pairedLayer].ghosts;
    const ghostsOnStair = pairedGhosts.filter(g => g.x === pairedStair.x && g.y === pairedStair.y);
    for (const ghost of ghostsOnStair) {
        const idx = pairedGhosts.indexOf(ghost);
        if (idx > -1) pairedGhosts.splice(idx, 1);
        ghost.x = originalPlayerPos.x;
        ghost.y = originalPlayerPos.y;
        state.layers[originalPlayerPos.layer].ghosts.push(ghost);
        movedGhosts.add(ghost);
    }
    return movedGhosts;
}

/** 鬼移动冲突解决（与 gameLogic 相同的多轮贪婪） */
function resolveGhostConflicts(moveIntents, ghosts) {
    let maxIterations = ghosts.length + 1;
    let madeProgress = true;
    while (madeProgress && moveIntents.length > 0 && maxIterations > 0) {
        madeProgress = false;
        maxIterations--;
        const occupiedCells = new Set(ghosts.map(g => `${g.x},${g.y}`));
        const possibleMoves = [];
        const remaining = [];
        for (const intent of moveIntents) {
            const key = `${intent.nextStep.x},${intent.nextStep.y}`;
            if (occupiedCells.has(key)) remaining.push(intent);
            else possibleMoves.push(intent);
        }
        const claimed = new Set();
        const finalMoves = [];
        for (const intent of possibleMoves) {
            const key = `${intent.nextStep.x},${intent.nextStep.y}`;
            if (!claimed.has(key)) {
                claimed.add(key);
                finalMoves.push(intent);
            } else {
                remaining.push(intent);
            }
        }
        for (const { ghost, nextStep } of finalMoves) {
            ghost.x = nextStep.x;
            ghost.y = nextStep.y;
            madeProgress = true;
        }
        moveIntents = remaining;
    }
}

/** 复刻 gameLogic.moveGhostsWithStairChase（普通移动后的鬼移动） */
function moveGhostsWithStairChase(state, sim, originalPlayerPos) {
    const playerLayer = state.player.layer;

    let ghostsMovedViaStair = new Set();
    if (sim.multiLayer) {
        ghostsMovedViaStair = handleGhostStairChase(state, sim, originalPlayerPos);
    }

    const ghosts = state.layers[playerLayer].ghosts;
    const moveIntents = [];
    for (const ghost of ghosts) {
        if (ghostsMovedViaStair.has(ghost)) continue;
        const sawBefore = canGhostSeePlayer(sim, state, playerLayer, ghost, originalPlayerPos);
        const seesAfter = canGhostSeePlayer(sim, state, playerLayer, ghost, state.player);

        let target = null;
        if (!sawBefore && seesAfter) target = state.player;
        else if (sawBefore && !seesAfter) target = originalPlayerPos;
        else if (sawBefore && seesAfter) target = state.player;

        if (target) {
            const path = findGhostPath(sim, playerLayer, state, ghost, target);
            if (path && path.length > 1) {
                moveIntents.push({ ghost, nextStep: path[1] });
            }
        }
    }
    if (moveIntents.length > 0) {
        resolveGhostConflicts(moveIntents, ghosts);
    }
}

/** 复刻 gameLogic.moveGhostsAfterStair（使用楼梯后的鬼移动：原层看到玩家的鬼朝原位置走一步） */
function moveGhostsAfterStair(state, sim, originalPlayerPos) {
    const originalLayer = originalPlayerPos.layer;
    const ghosts = state.layers[originalLayer].ghosts;
    const moveIntents = [];
    for (const ghost of ghosts) {
        const sawBefore = canGhostSeePlayer(sim, state, originalLayer, ghost, originalPlayerPos);
        if (sawBefore) {
            const path = findGhostPath(sim, originalLayer, state, ghost, originalPlayerPos);
            if (path && path.length > 1) {
                moveIntents.push({ ghost, nextStep: path[1] });
            }
        }
    }
    if (moveIntents.length > 0) {
        resolveGhostConflicts(moveIntents, ghosts);
    }
}

/** 复刻 gameLogic.checkCollisions */
function checkCollisions(state, sim) {
    const p = state.player;
    const ghosts = state.layers[p.layer].ghosts;
    if (ghosts.some(g => g.x === p.x && g.y === p.y)) {
        state.isDead = true;
        if (sim.gameMode === 'exploration') {
            p.hp--;
        }
    }
}

/** 复刻 gameLogic.checkWinLossConditions（胜负判定） */
function checkWinLossConditions(state, sim) {
    const p = state.player;
    const endPos = sim.layers[p.layer].endPos;
    if (endPos && p.x === endPos.x && p.y === endPos.y) {
        state.isWon = true;
    }
    if (sim.gameMode === 'exploration' && p.hp <= 0) {
        state.isDead = true;
    }
    if (sim.gameMode === 'death-loop' && p.stamina <= 0) {
        state.isDead = true;
    }
}

// ==================================================
// 对外接口
// ==================================================

/**
 * 推进一步（完整复刻 gameLogic.calculateNextState 的顺序语义）：
 * 执行动作 → 拾取 → 踩终点判胜（先于鬼移动）→ 鬼移动 → 碰撞 → 胜负
 * @param {object} state - 当前紧凑状态
 * @param {object} action - { type:'MOVE'|'USE_STAIR'|'PRESS_BUTTON'|'REVIVE', payload }
 * @param {object} sim - makeSimulator 返回值
 * @returns {object} 新状态；无效动作返回同引用
 */
export function step(state, action, sim) {
    if (state.isDead || state.isWon) {
        if (action.type === 'REVIVE') {
            return revive(state, sim);
        }
        return state;
    }

    const next = cloneState(state);
    const originalPlayerPos = { x: state.player.x, y: state.player.y, layer: state.player.layer };

    let stateChanged = false;
    let isStairAction = false;

    switch (action.type) {
        case 'MOVE':
            stateChanged = handleMove(next, sim, action.payload);
            break;
        case 'USE_STAIR':
            stateChanged = handleUseStair(next, sim);
            isStairAction = true;
            break;
        case 'PRESS_BUTTON':
            stateChanged = handlePressButton(next, sim, action.payload.letter);
            break;
        case 'REVIVE':
            return revive(state, sim);
        default:
            return state;
    }

    if (!stateChanged) {
        return state;
    }

    handleItemPickup(next, sim);

    // 玩家已踩终点：立即判胜（先于鬼移动/碰撞）
    const endPos = sim.layers[next.player.layer].endPos;
    if (endPos && next.player.x === endPos.x && next.player.y === endPos.y) {
        next.isWon = true;
        return next;
    }

    if (sim.withGhosts) {
        if (isStairAction) {
            moveGhostsAfterStair(next, sim, originalPlayerPos);
        } else {
            moveGhostsWithStairChase(next, sim, originalPlayerPos);
        }
        checkCollisions(next, sim);
    }

    checkWinLossConditions(next, sim);
    return next;
}

/** 复刻 gameLogic.handleRevive（死亡循环：重置保留 loopCount；探索：回出生点） */
function revive(state, sim) {
    if (sim.gameMode === 'exploration') {
        if (state.player.hp <= 0) return state;
        const next = cloneState(state);
        next.isDead = false;
        next.player.x = sim.startPos.x;
        next.player.y = sim.startPos.y;
        next.player.layer = sim.startPos.layer;
        return next;
    }
    // death-loop：整个地图重置（物品/钥匙/墙/鬼复位），保留 loopCount 与视野（模拟器无视野）
    const next = createInitState(sim);
    next.loopCount = state.loopCount + 1;
    return next;
}

/**
 * 状态规范化键（去重用）：仅忽略视觉和累计代价字段；保留体力、生命与终止标志
 *
 * 必须完整刻画"未来转移"的状态分量：
 * - player 的 layer/x/y/keys/hp/stamina（位置、资源与生命）
 * - wallBits（LOCKED 消耗 / 字母门开关，决定墙的通行与视野）
 * - 剩余物品（**关键**：两个 keys 相同的状态可能剩余钥匙集合不同——
 *   一个已捡过 (x,y) 的钥匙、一个没捡，未来转移不同，key 必须区分）
 * - 鬼位（withGhosts 时）
 * @param {object} state - 紧凑状态
 * @param {object} sim - 模拟器
 * @param {object} opts - { withGhosts: boolean } 默认 true（含鬼位）
 */
export function stateKey(state, sim, opts = {}) {
    const p = state.player;
    let key = `${p.layer},${p.x},${p.y},${p.keys},${p.hp},${p.stamina},${state.isDead},${state.isWon},${state.wallBits}`;
    // 剩余物品签名（物品状态影响未来转移：站在钥匙格上可拾取）
    const itemSig = state.layers.map((l, i) =>
        `${i}:${JSON.stringify(l.items.map(it => [it.x, it.y, it.type]))}`
    ).join(';');
    key += '|' + itemSig;
    const withGhosts = opts.withGhosts !== false && sim.withGhosts;
    if (withGhosts) {
        const sig = [];
        for (let i = 0; i < sim.layerCount; i++) {
            const gs = state.layers[i].ghosts.map(g => `${g.x},${g.y}`).join('|');
            sig.push(`${i}:${gs}`);
        }
        key += '|g:' + sig.join(';');
    }
    return key;
}

/** 当前层终点 */
export function getEndPos(sim, layer) {
    return sim.layers[layer] ? sim.layers[layer].endPos : null;
}

/** 必须已经经过引擎判胜；初始坐标等于终点不代表零动作胜利。 */
export function isWin(state, sim) {
    return state.isWon && !state.isDead;
}
