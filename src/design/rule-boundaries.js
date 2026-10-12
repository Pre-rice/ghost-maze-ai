import { createReferenceEnvironment, actionFromName } from '../reference/environment.js';
import { GameLogic, WALL_TYPES as W, validateMapData } from '../reference/engine.js';

// 编号、排列与观察记录不参与物理；保留同格鬼数。
const physical = state => JSON.stringify({
    player: [state.player.x, state.player.y, state.player.layer, state.player.hp, state.player.keys],
    dead: state.isDead, won: state.isWon,
    layers: state.layerStates.map(layer => ({
        ghosts: layer.ghosts.map(g => [g.x, g.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]),
        items: layer.items.map(i => [i.x, i.y, i.type]).sort(),
        walls: ['h', 'v'].map(axis => layer.wallStates[axis].map(row => row.map(w => [
            w.type === W.GLASS ? W.SOLID : w.type, w.keys, w.letter, w.currentState, w.direction
        ])))
    }))
});
const hasOverlap = state => state.layerStates.some(layer =>
    new Set(layer.ghosts.map(g => `${g.x},${g.y}`)).size < layer.ghosts.length);

/** 全部最优无伤解不得经过重合；玻璃换墙仍核对全部可达物理后继。 */
export function auditPuzzleBoundaries(map, { nodeBudget = 250000, budgetMs = 10000 } = {}) {
    if (!Number.isSafeInteger(nodeBudget) || nodeBudget < 0 || !Number.isFinite(budgetMs) || budgetMs < 0) {
        throw new TypeError('边界审查预算必须为有效非负数');
    }
    const checked = validateMapData(map, { requireEnd: false });
    if (!checked.valid) {
        if (checked.error.includes('出生点不能与鬼重叠')) return { status: 'conflict', reason: 'ghost_on_spawn', witness: [] };
        throw new TypeError(checked.error);
    }
    const env = createReferenceEnvironment(checked.mapData);
    const replacement = structuredClone(checked.mapData);
    let glassCount = 0;
    for (const layer of replacement.layers) for (const field of ['hWalls', 'vWalls']) for (const row of layer[field]) for (const wall of row) {
        if (wall.type === W.GLASS) { glassCount++; wall.type = W.SOLID; }
    }
    const solid = glassCount ? createReferenceEnvironment(replacement) : null;
    const initial = env.initialState();
    const queue = [{ state: initial, solid: solid?.initialState(), usedOverlap: false, depth: 0, parent: -1, action: null }];
    // 路线是否曾重合必须进入键，否则安全路线会吞并同长的重合路线。
    const seen = new Set([physical(initial) + '|overlap:false']), started = Date.now();
    let expanded = 0, transitions = 0, optimum = initial.isWon ? 0 : Infinity;
    let ignoredFatalOverlap = 0, observedNonFatalOverlap = null, safeOptimalWitness = initial.isWon ? [] : null;
    const prefix = head => {
        const actions = [];
        for (let i = head; queue[i].parent >= 0; i = queue[i].parent) actions.push(queue[i].action);
        return actions.reverse();
    };
    const result = (status, reason, extra = {}) => ({ status, reason, mapId: env.mapId, ruleset: env.ruleset,
        policy: 'all_optimal_routes_avoid_overlap_v2', glassCount, expanded, transitions, discovered: seen.size,
        optimum: Number.isFinite(optimum) ? optimum : null, ignoredFatalOverlap, observedNonFatalOverlap,
        safeOptimalWitness, elapsedMs: Date.now() - started,
        scope: '全部最优无伤无复活解不经过鬼重合；玻璃换实墙核对全部无伤可达物理后继含死亡动作，观察差异排除', ...extra });
    for (let head = 0; head < queue.length; head++) {
        const node = queue[head];
        if (!solid && node.depth >= optimum) break;
        if (expanded >= nodeBudget || Date.now() - started >= budgetMs) return result('unknown', 'budget');
        expanded++;
        if (node.state.isWon || node.state.isDead) continue;
        for (const action of env.actions) {
            if (Date.now() - started >= budgetMs) return result('unknown', 'budget');
            const diagnostics = [];
            const next = GameLogic.calculateNextState(node.state, actionFromName(action), env.mapDefinition,
                { trails: false, visibility: false, ghostDiagnostics: diagnostics });
            transitions++;
            const other = solid?.step(node.solid, action);
            if (solid && physical(next) !== physical(other)) {
                return result('conflict', 'functional_glass', { witness: [...prefix(head), action] });
            }
            if (next === node.state) continue;
            const overlap = hasOverlap(next);
            if (next.isDead) { if (overlap) ignoredFatalOverlap++; continue; }
            const usedOverlap = node.usedOverlap || overlap;
            if (overlap && !observedNonFatalOverlap) {
                observedNonFatalOverlap = { witness: [...prefix(head), action], conflict: diagnostics.find(d =>
                    next.layerStates[d.layer].ghosts.filter(g => g.x === d.target.x && g.y === d.target.y).length > 1) };
            }
            if (next.isWon) {
                const depth = node.depth + 1;
                optimum = Math.min(optimum, depth);
                if (depth === optimum && usedOverlap) {
                    return result('conflict', 'optimal_solution_uses_overlap', { witness: [...prefix(head), action] });
                }
                if (depth === optimum && !usedOverlap) safeOptimalWitness ??= [...prefix(head), action];
                continue;
            }
            const key = physical(next) + '|overlap:' + usedOverlap;
            if (seen.has(key)) continue;
            seen.add(key); queue.push({ state: next, solid: other, usedOverlap, depth: node.depth + 1, parent: head, action });
        }
    }
    if (!Number.isFinite(optimum)) return result('conflict', 'no_winning_solution');
    return result('safe', 'all_optimal_routes_avoid_overlap');
}

export function assertPuzzleBoundarySafety(map, options) {
    const result = auditPuzzleBoundaries(map, options);
    if (result.status !== 'safe') throw new Error(`地图未通过边界机制审查：${result.reason}（${result.status}）`);
    return result;
}
