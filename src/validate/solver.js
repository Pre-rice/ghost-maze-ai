import { WALL_TYPES } from '../engine/constants.js';
import { DIRS4, wallStateBetween, isGhostVisionBlocked } from './wallIndex.js';
import { makeSimulator, createInitState, step, stateKey, isWin } from './simulator.js';
import { relaxedDistField } from './solvabilityVerifier.js';

/**
 * solver 模块 - 无伤通关求解器（A* + 时限/内存降级 + 解法特征）
 *
 * 目标：找到一条"无伤可通"路径（全程不被鬼咬死、不耗尽 stamina），
 * 且路径长度 ≤ death-loop 初始 stamina（无伤路径步数约束由 stamina 隐式保证：
 * 耗尽即 isDead，死状态不入搜索）。
 *
 * 搜索语义（与已批准计划一致）：
 * - 启发式 h = relaxedDistField（忽略鬼、放宽钥匙/单向/字母门约束的 BFS 距离场，严格下界）
 * - 去重键 = layer,x,y,keys,wallBits,ghostSig（含鬼位，确定性）
 * - 先贪心快速找上界 → A* 限界搜索（f < upperBound）→ 双预算（节点数/内存/时间）
 * - 超预算降级：返回贪心结果（confidence:'approx'），不保证最优；贪心亦无解则保守报不可解
 *
 * 输出解法特征（精妙度评分输入）：
 * - detourSteps / nonGreedyRatio：相对"无视约束直走下界"的绕路量
 * - mechanismUses：路径通过的 LOCKED 门数
 * - keyDepth：按路径顺序的非降需求链长度（钥匙序层级）
 * - backtrackCount：路径中松弛距离回升次数（"先远离终点再回来"，反直觉性）
 * - explorationRate：路径覆盖格子占比
 */

/** 极小二叉堆（f 升序） */
class PQueue {
    constructor() {
        this.items = []; // [f, key]
    }
    push(f, key) {
        this.items.push([f, key]);
        let i = this.items.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.items[p][0] <= this.items[i][0]) break;
            const t = this.items[p];
            this.items[p] = this.items[i];
            this.items[i] = t;
            i = p;
        }
    }
    pop() {
        const top = this.items[0];
        const last = this.items.pop();
        if (this.items.length > 0) {
            this.items[0] = last;
            let i = 0;
            for (;;) {
                const l = i * 2 + 1;
                const r = i * 2 + 2;
                let m = i;
                if (l < this.items.length && this.items[l][0] < this.items[m][0]) m = l;
                if (r < this.items.length && this.items[r][0] < this.items[m][0]) m = r;
                if (m === i) break;
                const t = this.items[m];
                this.items[m] = this.items[i];
                this.items[i] = t;
                i = m;
            }
        }
        return top;
    }
    get size() {
        return this.items.length;
    }
}

function hOf(sim, fields, state) {
    return fields[state.player.layer][state.player.y][state.player.x];
}

/** 生成 MOVE 邻居动作列表（多层时附加 USE_STAIR） */
function neighborActions(sim) {
    const acts = DIRS4.map(({ dx, dy }) => ({ type: 'MOVE', payload: { dx, dy } }));
    if (sim.multiLayer) {
        acts.push({ type: 'USE_STAIR' });
    }
    return acts;
}

/** 贪心降级：每步选 h 最小（f 最小）的合法邻居，visited 防循环 */
function greedySolve(sim, fields, start, maxSteps) {
    let s = start;
    const visited = new Set([stateKey(s, sim)]);
    const moves = [];
    const actions = neighborActions(sim);
    for (let i = 0; i < maxSteps; i++) {
        if (isWin(s, sim)) return moves;
        let best = null;
        for (const action of actions) {
            const ns = step(s, action, sim);
            if (ns === s || ns.isDead) continue;
            const k = stateKey(ns, sim);
            if (visited.has(k)) continue;
            const h = hOf(sim, fields, ns);
            if (!best || h < best.h) best = { ns, h, action };
        }
        if (!best) return null;
        visited.add(stateKey(best.ns, sim));
        moves.push(best.action);
        s = best.ns;
    }
    return isWin(s, sim) ? moves : null;
}

/** 回溯 A* 路径 → 动作列表 */
function reconstructPath(entry, goalKey) {
    const moves = [];
    let key = goalKey;
    while (key) {
        const e = entry.get(key);
        if (!e) break;
        if (e.action) moves.push(e.action);
        key = e.prevKey;
    }
    moves.reverse();
    return moves;
}

/**
 * 鬼交互统计（解法被鬼威胁程度，修复"全程不遇鬼"的量化抓手）：
 * - seen：玩家当前格是否被本层任一鬼"直线看到"（复刻 gameLogic._canGhostSeePlayer，
 *   走动态墙、isGhostVisionBlocked 判定，与 simulator.canGhostSeePlayer 等价）；
 * - minDist：玩家与本层鬼的最近曼哈顿距离。
 */
function ghostInteraction(sim, state) {
    const playerPos = { x: state.player.x, y: state.player.y };
    const ghosts = state.layers[state.player.layer].ghosts;
    const ws = state.layers[state.player.layer].wallStates;
    let seen = false;
    let minDist = Infinity;
    for (const g of ghosts) {
        const d = Math.abs(g.x - playerPos.x) + Math.abs(g.y - playerPos.y);
        if (d < minDist) minDist = d;
        if (g.x !== playerPos.x && g.y !== playerPos.y) continue;
        let blocked = false;
        if (g.x === playerPos.x) {
            const y0 = Math.min(g.y, playerPos.y);
            const y1 = Math.max(g.y, playerPos.y);
            for (let y = y0; y < y1; y++) {
                const w = ws.h[y + 1] ? ws.h[y + 1][g.x] : null;
                if (w && isGhostVisionBlocked(w)) { blocked = true; break; }
            }
        } else {
            const x0 = Math.min(g.x, playerPos.x);
            const x1 = Math.max(g.x, playerPos.x);
            for (let x = x0; x < x1; x++) {
                const w = ws.v[g.y] ? ws.v[g.y][x + 1] : null;
                if (w && isGhostVisionBlocked(w)) { blocked = true; break; }
            }
        }
        if (!blocked) seen = true;
    }
    return { seen, minDist };
}

/** 重放路径计算解法特征 */
function computeFeatures(sim, fields, start, moves) {
    let s = start;
    let prevH = hOf(sim, fields, s);
    let backtrackCount = 0;
    const lockReqs = [];
    const visitedCells = new Set([`${s.player.x},${s.player.y}`]);
    let ghostSeenSteps = 0;
    let minGhostDist = Infinity;

    const tally = () => {
        const gi = ghostInteraction(sim, s);
        if (gi.seen) ghostSeenSteps++;
        if (gi.minDist < minGhostDist) minGhostDist = gi.minDist;
    };
    tally(); // 起始位置也计（鬼可能在起点视线内）

    for (const m of moves) {
        if (m.type === 'MOVE') {
            const ws = s.layers[s.player.layer].wallStates;
            const wall = wallStateBetween(s.player.x, s.player.y, m.payload.dx, m.payload.dy, ws);
            // 通过 LOCKED 门时记录需求（先查后步，通过后动态墙已变 EMPTY）
            if (wall && wall.type === WALL_TYPES.LOCKED) {
                lockReqs.push(wall.keys || 0);
            }
        }
        s = step(s, m, sim);
        const h = hOf(sim, fields, s);
        if (h > prevH) backtrackCount++;
        prevH = h;
        visitedCells.add(`${s.player.x},${s.player.y}`);
        tally();
    }

    // 钥匙序深度：按路径顺序的"非降需求链"长度
    let keyDepth = 0;
    let lastReq = -1;
    for (const req of lockReqs) {
        if (req >= lastReq) {
            keyDepth++;
            lastReq = req;
        }
    }

    const minSteps = moves.length;
    // 相对"无视约束直走下界"的绕路量（relaxed 距离是下界，差恒 ≥ 0）
    const greedySteps = fields[start.player.layer][start.player.y][start.player.x];
    const detourSteps = Number.isFinite(greedySteps) ? Math.max(0, minSteps - greedySteps) : 0;

    return {
        detourSteps,
        nonGreedyRatio: minSteps > 0 ? detourSteps / minSteps : 0,
        mechanismUses: lockReqs.length,
        keyDepth,
        backtrackCount,
        explorationRate: visitedCells.size / (sim.width * sim.height),
        greedySteps: Number.isFinite(greedySteps) ? greedySteps : -1,
        ghostSeenSteps,
        ghostSeenRatio: minSteps > 0 ? ghostSeenSteps / minSteps : (ghostSeenSteps > 0 ? 1 : 0),
        minGhostDist
    };
}

/**
 * 求解无伤通关路径
 * @param {object} mapData - 地图数据
 * @param {object} opts - { withGhosts:boolean, nodeBudget:number, entryBudget:number, budgetMs:number }
 * @returns {object} { solvable, confidence:'optimal'|'approx'|'none', moves, minSteps,
 *                      difficulty:{minSteps,minHits,explorationRate}, solutionFeatures }
 */
export function solveMap(mapData, opts = {}) {
    const {
        withGhosts = true,
        nodeBudget = 100000,
        entryBudget = 40000,
        budgetMs = 3000
    } = opts;

    const sim = makeSimulator(mapData, { withGhosts });
    const fields = relaxedDistField(sim);
    const start = createInitState(sim);
    const startH = hOf(sim, fields, start);

    // 起点所在层到本层终点不可达 → 立即不可解
    if (!Number.isFinite(startH)) {
        return {
            solvable: false,
            confidence: 'none',
            reason: 'start_unreachable',
            moves: [],
            minSteps: -1,
            difficulty: null,
            solutionFeatures: null
        };
    }

    const t0 = Date.now();
    const maxSteps = sim.initialStamina + 8; // 贪心防循环上限（留按钮不耗体的余量）

    // 1) 贪心快速找上界
    const greedyMoves = greedySolve(sim, fields, start, maxSteps);

    // 2) A* 限界搜索：f < upperBound（有上界时第一个弹出的目标即最优）
    const actions = neighborActions(sim);
    const entry = new Map(); // key -> { g, prevKey, action, state }
    const gBest = new Map(); // key -> 已入堆的 g（lazy deletion 判定）
    const startKey = stateKey(start, sim);
    entry.set(startKey, { g: 0, prevKey: null, action: null, state: start });
    gBest.set(startKey, 0);
    const pq = new PQueue();
    pq.push(startH, startKey);

    const upperBound = greedyMoves ? greedyMoves.length : Infinity;
    let explored = 0;
    let goalKey = null;

    while (pq.size > 0) {
        if (explored >= nodeBudget || entry.size >= entryBudget || Date.now() - t0 > budgetMs) {
            break; // 超预算 → 降级
        }
        const [f, key] = pq.pop();
        const e = entry.get(key);
        if (!e || e.g !== gBest.get(key)) continue; // 过时条目（lazy deletion）
        explored++;

        if (isWin(e.state, sim)) {
            goalKey = key;
            break;
        }

        const st = e.state;
        for (const action of actions) {
            const ns = step(st, action, sim);
            if (ns === st || ns.isDead) continue; // 无效动作 / 死状态（含 stamina 耗尽）
            const nk = stateKey(ns, sim);
            const ng = e.g + 1;
            if (ng >= gBest.get(nk) ?? Infinity) continue;
            if (entry.size >= entryBudget) break;
            const nh = hOf(sim, fields, ns);
            if (!Number.isFinite(nh)) continue; // 单层：本层终点不可达 → 剪枝
            if (ng + nh >= upperBound) continue; // 限界剪枝（上界存在时保最优性）
            entry.set(nk, { g: ng, prevKey: key, action, state: ns });
            gBest.set(nk, ng);
            pq.push(ng + nh, nk);
        }
    }

    // 3) 结果组装
    if (goalKey) {
        const moves = reconstructPath(entry, goalKey);
        const features = computeFeatures(sim, fields, start, moves);
        return {
            solvable: true,
            confidence: 'optimal',
            moves,
            minSteps: moves.length,
            difficulty: {
                minSteps: moves.length,
                minHits: 0,
                explorationRate: features.explorationRate,
                ghostSeenSteps: features.ghostSeenSteps,
                minGhostDist: features.minGhostDist
            },
            solutionFeatures: features
        };
    }

    // 降级：贪心有解 → approx（不保证最优）；否则保守不可解
    if (greedyMoves) {
        const features = computeFeatures(sim, fields, start, greedyMoves);
        return {
            solvable: true,
            confidence: 'approx',
            moves: greedyMoves,
            minSteps: greedyMoves.length,
            difficulty: {
                minSteps: greedyMoves.length,
                minHits: 0,
                explorationRate: features.explorationRate,
                ghostSeenSteps: features.ghostSeenSteps,
                minGhostDist: features.minGhostDist
            },
            solutionFeatures: features
        };
    }

    return {
        solvable: false,
        confidence: 'none',
        reason: 'unsolvable_or_budget',
        moves: [],
        minSteps: -1,
        difficulty: null,
        solutionFeatures: null
    };
}
