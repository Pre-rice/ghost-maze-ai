import { createReferenceEnvironment, actionFromName } from '../reference/environment.js';
import { GameLogic, WALL_TYPES as W, validateMapData } from '../reference/engine.js';

// 忽略不可见编号、列表排列和观察记录；这些量不参与当前动作物理。
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

/** 检查全部无伤可达状态及其合法后继；有预算未决就不能交付。 */
export function auditPuzzleBoundaries(map, { nodeBudget = 250000, budgetMs = 10000 } = {}) {
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
    const queue = [{ state: env.initialState(), solid: solid?.initialState(), parent: -1, action: null }];
    const seen = new Set([physical(queue[0].state)]), started = Date.now();
    const p = queue[0].state.player;
    if (queue[0].state.layerStates[p.layer].ghosts.some(g => g.x === p.x && g.y === p.y)) {
        return { status: 'conflict', reason: 'ghost_on_spawn', mapId: env.mapId, ruleset: env.ruleset, witness: [], glassCount };
    }
    let expanded = 0, transitions = 0;
    const prefix = head => {
        const actions = [];
        for (let i = head; queue[i].parent >= 0; i = queue[i].parent) actions.push(queue[i].action);
        return actions.reverse();
    };
    const result = (status, reason, extra = {}) => ({ status, reason, mapId: env.mapId, ruleset: env.ruleset,
        glassCount, expanded, transitions, discovered: seen.size, elapsedMs: Date.now() - started,
        scope: '全部无伤无复活可达状态及其有效后继；玻璃与实墙比较全部物理结果，观察差异排除', ...extra });
    for (let head = 0; head < queue.length; head++) {
        if (expanded >= nodeBudget || Date.now() - started >= budgetMs) return result('unknown', 'budget');
        const node = queue[head]; expanded++;
        if (node.state.isWon || node.state.isDead) continue;
        for (const action of env.actions) {
            const diagnostics = [];
            const next = GameLogic.calculateNextState(node.state, actionFromName(action), env.mapDefinition,
                { trails: false, visibility: false, ghostDiagnostics: diagnostics });
            transitions++;
            const ambiguous = diagnostics.find(d => next.layerStates[d.layer].ghosts.filter(g => g.x === d.target.x && g.y === d.target.y).length > 1);
            if (ambiguous) return result('conflict', ambiguous.capturesPlayer ? 'ghost_capture_overlap' : 'symmetric_ghost_overlap', { witness: [...prefix(head), action], conflict: ambiguous });
            if (solid) {
                const other = solid.step(node.solid, action);
                if (physical(next) !== physical(other)) return result('conflict', 'functional_glass', { witness: [...prefix(head), action] });
                if (next === node.state) continue;
                if (next.isDead || next.isWon) continue;
                const key = physical(next); if (seen.has(key)) continue;
                seen.add(key); queue.push({ state: next, solid: other, parent: head, action });
            } else {
                if (next === node.state || next.isDead || next.isWon) continue;
                const key = physical(next); if (seen.has(key)) continue;
                seen.add(key); queue.push({ state: next, parent: head, action });
            }
        }
    }
    return result('safe', 'frontier_exhausted');
}

export function assertPuzzleBoundarySafety(map, options) {
    const result = auditPuzzleBoundaries(map, options);
    if (result.status !== 'safe') throw new Error(`地图未通过边界机制审查：${result.reason}（${result.status}）`);
    return result;
}
