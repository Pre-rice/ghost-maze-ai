import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { assertButtonAttachments } from '../../src/design/button-support.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';

export const budget = { nodeBudget: 180000, stateBudget: 220000, budgetMs: 5000 };
export const referenceBudget = { nodeBudget: 120000, stateBudget: 150000, budgetMs: 30000 };
const press = letter => ({ type: 'press', letter });
const at = (x, y) => ({ type: 'ghost_at', layer: 0, x, y });
const gate = (axis, x, y, state) => ({ type: 'gate', layer: 0, axis, x, y, state });
const all = (...events) => ({ type: 'all', events });
const cross = (index, fx, fy, tx, ty) => ({ type: 'ghost_cross', layer: 0, index, from: { x: fx, y: fy }, to: { x: tx, y: ty } });
export const temporary = all(press('B'), at(3, 2), gate('h', 3, 2, 'closed'));
export const finalSeal = all(press('A'), at(4, 3), at(3, 1), gate('h', 4, 4, 'closed'));
export const constraints = [
    { id: 'temporary_center_before_B', sequence: [temporary] },
    { id: 'temporary_then_upper_moves', sequence: [temporary, cross(0, 2, 1, 3, 1)] },
    { id: 'leave_center_after_upper_moves', sequence: [cross(0, 2, 1, 3, 1), cross(1, 3, 2, 3, 3)] },
    { id: 'final_shared_seal', sequence: [finalSeal] },
    { id: 'A_reused', sequence: [press('A'), press('A')] }
];

// 只保留临时安置、引出上鬼、再安置和共同隔离的关系，不评价趣味。
export function createEvaluator() {
    const cache = new Map();
    return map => {
        let env;
        try { assertButtonAttachments(map); env = createReferenceEnvironment(map); }
        catch { return { accepted: false, reason: 'invalid' }; }
        if (cache.has(env.mapId)) return cache.get(env.mapId);
        const done = value => { cache.set(env.mapId, value); return value; };
        if (map.initialGhosts.length !== 2 || map.buttons.length !== 2 || map.items.length || ![[3, 2], [3, 1], [2, 1], [4, 3], [3, 3]].every(([x, y]) => map.activeCells[y]?.[x]) ||
            ![['h', 3, 2], ['h', 4, 4]].every(([axis, x, y]) => map[axis + 'Walls'][y][x].type === W.LETTER_DOOR)) return done({ accepted: false, reason: 'changed_relation' });
        const baseline = solveFastMap(map, budget);
        if (baseline.status !== 'solved' || baseline.optimality !== 'proven') return done({ accepted: false, reason: baseline.status === 'unknown' ? 'unknown' : 'unsat' });
        // 关门当刻的停位不足以证明安全撤离，证书的最后一段也必须复查。
        let state = env.initialState(), lastPress = -1, lastMove = -1;
        for (const [i, action] of baseline.solution.actions.entries()) {
            const next = env.step(state, action);
            if (next !== state && next.player.x === state.player.x && next.player.y === state.player.y && next.player.layer === state.player.layer) lastPress = i;
            if (next.layerStates[0].ghosts.some((g, j) =>
                g.x !== state.layerStates[0].ghosts[j].x || g.y !== state.layerStates[0].ghosts[j].y)) lastMove = i;
            state = next;
        }
        if (lastMove >= lastPress) return done({ accepted: false, reason: 'chased_after_final_seal' });
        const proofs = [];
        for (const condition of constraints) {
            const result = solveFastMap(map, { ...budget, restrictions: [condition] });
            if (result.status !== 'proven_unsat') return done({ accepted: false, reason: result.status === 'unknown' ? 'unknown' : 'relation_avoidable', condition, result });
            proofs.push({ condition, result });
        }
        const reversed = structuredClone(map); reversed.initialGhosts.reverse();
        try { if (!createReferenceEnvironment(reversed).replay(baseline.solution.actions).state.isWon) return done({ accepted: false, reason: 'order_sensitive' }); }
        catch { return done({ accepted: false, reason: 'order_sensitive' }); }
        return done({ accepted: true, baseline, proofs });
    };
}
