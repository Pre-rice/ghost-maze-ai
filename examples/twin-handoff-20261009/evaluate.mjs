import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';

export const budget = { nodeBudget: 80000, stateBudget: 100000, budgetMs: 5000 };
export const referenceBudget = { nodeBudget: 160000, stateBudget: 180000, budgetMs: 40000 };
export const edges = map => ['h', 'v'].flatMap(axis => map[axis + 'Walls'].flatMap((row, y) => row.map((wall, x) => ({ axis, x, y, wall }))));
export const proved = r => r.status === 'solved' && r.optimality === 'proven';
const press = letter => ({ type: 'press', letter });
const at = (x, y) => ({ type: 'ghost_at', layer: 0, x, y });
const station = (letter, x, y) => ({ type: 'all', events: [press(letter), { type: 'visit', layer: 0, x, y }] });
export const guard = { type: 'all', events: [station('B', 4, 4), at(4, 3),
    { type: 'gate', layer: 0, axis: 'h', x: 4, y: 4, state: 'closed' }] };
export const constraints = [
    { id: 'upper_ghost_leaves_goal_approach', sequence: [{ type: 'ghost_cross', layer: 0, index: 0, from: { x: 2, y: 1 }, to: { x: 3, y: 1 } }] },
    { id: 'restore_A_after_first_release', sequence: [press('A'), press('A')] },
    { id: 'B_captures_at_control_chamber', sequence: [guard] },
    { id: 'reconfigure_A_after_B_capture', sequence: [guard, station('A', 2, 5)] },
    { id: 'reopen_B_from_inner_station', sequence: [guard, station('A', 2, 5), station('B', 2, 1)] }
];

// 保留两条入口的互补门态与同组门之间的保护交接；这些条件不评价人类趣味。
export function createEvaluator() {
    const cache = new Map();
    return map => {
        const id = createReferenceEnvironment(map).mapId;
        if (cache.has(id)) return cache.get(id);
        const finish = result => { cache.set(id, result); return result; };
        if (map.initialGhosts.length !== 2 || map.buttons.length !== 3 ||
            map.items.length || edges(map).some(e => e.wall.type === W.GLASS) ||
            map.vWalls[1][3].type !== W.LETTER_DOOR ||
            map.hWalls[3][2].type !== W.LETTER_DOOR || map.hWalls[4][4].type !== W.LETTER_DOOR) return finish({ accepted: false, reason: 'changed_relation' });
        const baseline = solveFastMap(map, budget);
        if (!proved(baseline)) return finish({ accepted: false, reason: baseline.status === 'unknown' ? 'unknown' : 'unsat' });
        const proofs = [];
        for (const condition of constraints) {
            const result = solveFastMap(map, { ...budget, restrictions: [condition] });
            if (result.status !== 'proven_unsat') return finish({ accepted: false, reason: result.status === 'unknown' ? 'unknown' : 'relation_avoidable' });
            proofs.push({ condition, result });
        }
        const reversed = structuredClone(map); reversed.initialGhosts.reverse();
        try { if (!createReferenceEnvironment(reversed).replay(baseline.solution.actions).state.isWon) return finish({ accepted: false, reason: 'order_sensitive' }); }
        catch { return finish({ accepted: false, reason: 'order_sensitive' }); }
        return finish({ accepted: true, baseline, proofs });
    };
}
