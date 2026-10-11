import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';

export const budget = { nodeBudget: 100000, stateBudget: 120000, budgetMs: 5000 };
export const referenceBudget = { nodeBudget: 160000, stateBudget: 180000, budgetMs: 40000 };
export const proved = result => result.status === 'solved' && result.optimality === 'proven';
export const edges = map => ['h', 'v'].flatMap(axis => map[axis + 'Walls'].flatMap((row, y) => row.map((wall, x) => ({ axis, x, y, wall }))));
const press = letter => ({ type: 'press', letter });
const visit = (x, y) => ({ type: 'visit', layer: 0, x, y });
const at = (x, y) => ({ type: 'ghost_at', layer: 0, x, y });
const gate = (axis, x, y, state) => ({ type: 'gate', layer: 0, axis, x, y, state });
const all = (...events) => ({ type: 'all', events });
const station = (letter, x, y) => all(press(letter), visit(x, y));
export const bridge = { type: 'locked_opened', layer: 0, axis: 'v', x: 3, y: 2 };
export const lowerMoved = { type: 'ghost_cross', layer: 0, index: 1, from: { x: 2, y: 5 }, to: { x: 2, y: 6 } };
export const capture = all(press('B'), at(2, 4), gate('h', 2, 4, 'closed'), gate('h', 2, 3, 'open'));
export const remoteClosure = all(station('A', 3, 2), gate('h', 2, 3, 'closed'));
export const constraints = [
    { id: 'A_at_least_four', sequence: Array.from({ length: 4 }, () => press('A')) },
    { id: 'B_at_least_three', sequence: Array.from({ length: 3 }, () => press('B')) },
    { id: 'lower_guard_reaches_bottom', sequence: [lowerMoved] },
    { id: 'lower_displacement_then_A', sequence: [lowerMoved, press('A')] },
    { id: 'permanent_bridge_used_after_remote_closure', sequence: [bridge, remoteClosure, all(visit(2, 2), gate('h', 2, 2, 'open'), gate('h', 2, 3, 'closed'))] },
    { id: 'lower_displacement_before_B_protection', sequence: [lowerMoved, capture] },
    { id: 'B_takes_over_protection', sequence: [capture] },
    { id: 'B_protection_then_remote_A', sequence: [capture, station('A', 3, 2)] }
];

// 条件检验关乎机制关系；动作数与穷尽搜索不评价玩家是否觉得巧妙。
export function createEvaluator() {
    const cache = new Map();
    return map => {
        const id = createReferenceEnvironment(map).mapId;
        if (cache.has(id)) return cache.get(id);
        const finish = result => { cache.set(id, result); return result; };
        if (map.initialGhosts.length !== 2 || map.items.length !== 1 ||
            edges(map).some(e => e.wall.type === W.GLASS) || map.vWalls[2][3].type !== W.LOCKED ||
            map.hWalls[2][2].type !== W.LETTER_DOOR || map.hWalls[3][2].type !== W.LETTER_DOOR ||
            map.hWalls[4][2].type !== W.LETTER_DOOR ||
            ![[2, 2], [3, 2], [2, 4], [2, 5], [2, 6]].every(([x, y]) => map.activeCells[y]?.[x])) return finish({ accepted: false, reason: 'changed_relation' });
        const baseline = solveFastMap(map, budget);
        if (!proved(baseline)) return finish({ accepted: false, reason: baseline.status === 'unknown' ? 'unknown' : 'unsat' });
        const proofs = [];
        for (const condition of constraints) {
            const result = solveFastMap(map, { ...budget, restrictions: [condition] });
            if (result.status !== 'proven_unsat') return finish({ accepted: false, reason: result.status === 'unknown' ? 'unknown' : 'relation_avoidable', condition, result });
            proofs.push({ condition, result });
        }
        const reversed = structuredClone(map); reversed.initialGhosts.reverse();
        try { if (!createReferenceEnvironment(reversed).replay(baseline.solution.actions).state.isWon) return finish({ accepted: false, reason: 'order_sensitive' }); }
        catch { return finish({ accepted: false, reason: 'order_sensitive' }); }
        return finish({ accepted: true, baseline, proofs });
    };
}
