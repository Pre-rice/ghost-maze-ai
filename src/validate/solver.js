import { WALL_TYPES } from '../reference/engine.js';
import { wallStateBetween, isGhostVisionBlocked } from './wallIndex.js';
import { step } from './simulator.js';
import { createFastEnvironment } from '../search/fast-environment.js';
import { solveFastMap } from '../search/fast-solver.js';
import { relaxedDistField } from '../search/relaxed-distance.js';
import { actionFromName } from '../reference/environment.js';

// 兼容旧调用方的特征输出；物理判定和证书由修正后的三态 A* 负责。
const hOf = (sim, fields, state) => fields[state.player.layer][state.player.y][state.player.x];

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
    const visitedCells = new Set([`${s.player.layer},${s.player.x},${s.player.y}`]);
    let ghostSeenSteps = 0;
    let minGhostDist = Infinity;

    const tally = () => {
        const gi = ghostInteraction(sim, s);
        if (gi.seen) ghostSeenSteps++;
        if (gi.minDist < minGhostDist) minGhostDist = gi.minDist;
    };
    tally(); // 起始位置也计（鬼可能在起点视线内）

    for (const m of moves) {
        const next = step(s, m, sim);
        if (m.type === 'MOVE' && (next.player.x !== s.player.x || next.player.y !== s.player.y)) {
            const ws = s.layers[s.player.layer].wallStates;
            const wall = wallStateBetween(s.player.x, s.player.y, m.payload.dx, m.payload.dy, ws);
            // 通过 LOCKED 门时记录需求（先查后步，通过后动态墙已变 EMPTY）
            if (wall && wall.type === WALL_TYPES.LOCKED) {
                lockReqs.push(wall.keys || 0);
            }
        }
        s = next;
        const h = hOf(sim, fields, s);
        if (h > prevH) backtrackCount++;
        prevH = h;
        visitedCells.add(`${s.player.layer},${s.player.x},${s.player.y}`);
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
        explorationRate: visitedCells.size / sim.layers.reduce((count, layer) => count + layer.activeCells.flat().filter(Boolean).length, 0),
        greedySteps: Number.isFinite(greedySteps) ? greedySteps : -1,
        ghostSeenSteps,
        ghostSeenRatio: ghostSeenSteps / (minSteps + 1),
        minGhostDist
    };
}

/** 旧入口兼容：unknown 的 solvable 为 null，minSteps 仅表示当前证书动作数。 */
export function solveMap(mapData, options = {}) {
    const opts = { ...options };
    if (Object.hasOwn(opts, 'entryBudget')) {
        if (Object.hasOwn(opts, 'stateBudget')) throw new TypeError('entryBudget 与 stateBudget 不能同时指定');
        opts.stateBudget = opts.entryBudget;
        delete opts.entryBudget;
    }
    const result = solveFastMap(mapData, opts);
    const solved = result.status === 'solved';
    const moves = solved ? result.solution.actions.map(actionFromName) : [];
    let features = null;
    if (solved) {
        const env = createFastEnvironment(mapData, { withGhosts: opts.withGhosts ?? true });
        features = computeFeatures(env.sim, relaxedDistField(env.sim), env.initialState(), moves);
    }
    return {
        ...result, solvable: solved ? true : result.status === 'proven_unsat' ? false : null,
        confidence: solved ? result.optimality === 'proven' ? 'optimal' : 'approx' : 'none',
        moves, minSteps: solved ? result.solution.totalActions : -1,
        movementCost: solved ? result.solution.movementCost : null,
        difficulty: solved ? { minSteps: result.solution.totalActions, minHits: 0, explorationRate: features.explorationRate, ghostSeenSteps: features.ghostSeenSteps, minGhostDist: features.minGhostDist } : null,
        solutionFeatures: features
    };
}
