import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveContinuation } from '../../src/design/continuation.js';

export const budget = { nodeBudget: 80000, stateBudget: 100000, budgetMs: 5000 };
export const referenceBudget = { nodeBudget: 150000, stateBudget: 150000, budgetMs: 40000 };
export const commonPrefix = ['D', 'L', 'R', 'D', 'U', 'U', 'D', 'D'];
export const lock = { type: 'locked_opened', layer: 0, axis: 'h', x: 4, y: 4 };
const press = (letter, x, y) => ({ type: 'all', events: [{ type: 'press', letter }, { type: 'visit', layer: 0, x, y }] });
const park = { type: 'ghost_at', layer: 0, x: 3, y: 5 };
export const guard = { type: 'all', events: [press('B', 4, 5), park,
    { type: 'gate', layer: 0, axis: 'v', x: 4, y: 5, state: 'closed' }] };
export const constraints = [
    { id: 'open_lock', sequence: [lock] },
    { id: 'prepare_A_before_release', sequence: [{ type: 'press', letter: 'A' }, { type: 'ghost_cross', layer: 0, index: 0, from: { x: 4, y: 2 }, to: { x: 4, y: 3 } }] },
    { id: 'ghost_uses_opened_lock', sequence: [{ type: 'ghost_cross', layer: 0, index: 0, from: { x: 4, y: 3 }, to: { x: 4, y: 4 } }] },
    { id: 'park_at_lower_left', sequence: [park] },
    { id: 'guard_adjacent_ghost', sequence: [guard] },
    { id: 'guard_then_reconfigure_A', sequence: [guard, { type: 'press', letter: 'A' }] },
    { id: 'reopen_B_from_other_station', sequence: [guard, { type: 'press', letter: 'A' }, press('B', 4, 4)] }
];
export const edges = map => ['h', 'v'].flatMap(axis => map[axis + 'Walls'].flatMap((row, y) => row.map((wall, x) => ({ axis, x, y, wall }))));
export const proved = r => r.status === 'solved' && r.optimality === 'proven';

// 保留明确的提前准备与操作站位关系；不使用局部策略失败率或解法长度评价趣味。
export function createEvaluator() {
    const cache = new Map();
    return map => {
        const id = createReferenceEnvironment(map).mapId;
        if (cache.has(id)) return cache.get(id);
        const finish = e => { cache.set(id, e); return e; };
        if (map.initialStamina !== 100 || map.initialGhosts.length !== 1 || map.buttons.length !== 3 || map.items.length !== 1 ||
            edges(map).some(e => e.wall.type === W.GLASS) || map.hWalls[4][4].type !== W.LOCKED ||
            map.hWalls[3][4].type !== W.LETTER_DOOR || map.vWalls[5][4].type !== W.LETTER_DOOR) return finish({ accepted: false, reason: 'changed_scope' });
        const baseline = solveFastMap(map, budget);
        if (!proved(baseline)) return finish({ accepted: false, reason: baseline.status === 'unknown' ? 'unknown' : 'unsat' });
        let tempting, prepared;
        try {
            tempting = solveContinuation(map, [...commonPrefix, 'D'], budget);
            prepared = solveContinuation(map, [...commonPrefix, 'R'], budget);
        } catch { return finish({ accepted: false, reason: 'changed_decision_prefix' }); }
        if (tempting.status !== 'proven_unsat' || prepared.status !== 'solved') return finish({ accepted: false, reason: tempting.status === 'unknown' || prepared.status === 'unknown' ? 'unknown' : 'preparation_not_required' });
        const proofs = [];
        for (const condition of constraints) {
            const result = solveFastMap(map, { ...budget, restrictions: [condition] });
            if (result.status !== 'proven_unsat') return finish({ accepted: false, reason: result.status === 'unknown' ? 'unknown' : 'relation_avoidable' });
            proofs.push({ condition, result });
        }
        return finish({ accepted: true, baseline, tempting, prepared, proofs });
    };
}
