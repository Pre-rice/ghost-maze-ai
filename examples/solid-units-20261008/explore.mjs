import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { smallMap } from '../../src/design/grid.js';
import { seededRandom } from '../../src/design/edits.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment } from '../../src/search/fast-environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';

export const BUDGET = { nodeBudget: 20000, stateBudget: 20000, budgetMs: 2500 };
export const proved = result => result.status === 'solved' && result.optimality === 'proven';
export const walls = map => ['h', 'v'].flatMap(axis => map[axis + 'Walls'].flatMap((row, y) => row.map((wall, x) => ({ axis, x, y, wall }))));
const changedWall = (map, edge, type) => {
    const changed = structuredClone(map); changed[edge.axis + 'Walls'][edge.y][edge.x] = { type, keys: 0 }; return changed;
};
const cross = (a, b, edge) => edge.axis === 'h'
    ? a.x === edge.x && b.x === edge.x && Math.min(a.y, b.y) === edge.y - 1 && Math.max(a.y, b.y) === edge.y
    : a.y === edge.y && b.y === edge.y && Math.min(a.x, b.x) === edge.x - 1 && Math.max(a.x, b.x) === edge.x;

export function summarizeTrace(map, actions) {
    const env = createFastEnvironment(map), moves = map.initialGhosts.map(() => 0), locks = walls(map).filter(e => e.wall.type === W.LOCKED);
    let state = env.initialState(), presses = 0, ghostUsesLock = false;
    const rows = [];
    for (const [index, action] of actions.entries()) {
        const next = env.step(state, action), stationary = state.player.x === next.player.x && state.player.y === next.player.y;
        if (stationary) presses++;
        for (const [i, ghost] of state.layers[0].ghosts.entries()) {
            const after = next.layers[0].ghosts[i];
            if (ghost.x !== after.x || ghost.y !== after.y) moves[i]++;
            if (locks.some(edge => cross(ghost, after, edge))) ghostUsesLock = true;
        }
        rows.push({ index: index + 1, action, player: [next.player.x, next.player.y], ghosts: next.layers[0].ghosts.map(g => [g.x, g.y]), stationary, keys: next.player.keys });
        state = next;
    }
    return { rows, presses, ghostMoves: moves, ghostUsesLock };
}

/** 只筛选可验证的机制作用；不把搜索指标写成人类质量评分。 */
export function createEvaluator(kind) {
    const cache = new Map();
    return map => {
        if (walls(map).some(e => e.wall.type === W.GLASS)) return { accepted: false, reason: 'glass' };
        const id = createReferenceEnvironment(map).mapId;
        if (cache.has(id)) return cache.get(id);
        const finish = result => { cache.set(id, result); return result; };
        const edges = walls(map), arrows = edges.filter(e => e.wall.type === W.ONE_WAY), locks = edges.filter(e => e.wall.type === W.LOCKED);
        if (kind === 'arrow' && (arrows.length !== 1 || locks.length !== 1 || map.items.length !== 1 || map.initialGhosts.length !== 1)) return finish({ accepted: false, reason: 'changed_mechanism' });
        if (kind === 'switch' && (map.buttons.length !== 1 || map.initialGhosts.length < 1 || !edges.some(e => e.wall.type === W.LETTER_DOOR))) return finish({ accepted: false, reason: 'changed_mechanism' });
        const baseline = solveFastMap(map, BUDGET);
        if (!proved(baseline)) return finish({ accepted: false, reason: baseline.status === 'proven_unsat' ? 'unsat' : 'unknown' });
        const trace = summarizeTrace(map, baseline.solution.actions), contrasts = [], constraints = [];
        if (trace.ghostMoves.some(n => n < 2)) return finish({ accepted: false, reason: 'inactive_ghost' });
        const noGhost = solveFastMap(map, { ...BUDGET, withGhosts: false });
        if (!proved(noGhost) || baseline.solution.totalActions < noGhost.solution.totalActions + 5) return finish({ accepted: false, reason: 'weak_interaction' });
        if (kind === 'arrow') {
            if (!trace.ghostUsesLock) return finish({ accepted: false, reason: 'lock_not_used_by_ghost' });
            const door = solveFastMap(changedWall(map, arrows[0], W.DOOR), BUDGET);
            if (!proved(door) || door.solution.totalActions >= baseline.solution.totalActions) return finish({ accepted: false, reason: door.status === 'unknown' ? 'unknown' : 'arrow_direction_not_needed' });
            const lock = solveFastMap(changedWall(map, locks[0], W.DOOR), BUDGET);
            if (lock.status !== 'proven_unsat') return finish({ accepted: false, reason: lock.status === 'unknown' ? 'unknown' : 'consumed_lock_not_needed' });
            contrasts.push({ edit: { ...arrows[0], type: W.DOOR }, result: door }, { edit: { ...locks[0], type: W.DOOR }, result: lock });
        } else {
            if (trace.presses < 3) return finish({ accepted: false, reason: 'simple_switch' });
            const restrictions = [{ id: 'third_press', sequence: Array.from({ length: 3 }, () => ({ type: 'press', letter: 'A' })) }];
            const result = solveFastMap(map, { ...BUDGET, restrictions });
            if (result.status !== 'proven_unsat') return finish({ accepted: false, reason: result.status === 'unknown' ? 'unknown' : 'three_presses_avoidable' });
            constraints.push({ restrictions, result });
            if (map.initialGhosts.length === 2) {
                const reversed = structuredClone(map); reversed.initialGhosts.reverse();
                const result = solveFastMap(reversed, BUDGET);
                if (!proved(result) || result.solution.totalActions !== baseline.solution.totalActions) return finish({ accepted: false, reason: 'order_dependent' });
                try { createReferenceEnvironment(reversed).replay(baseline.solution.actions); }
                catch { return finish({ accepted: false, reason: 'order_dependent' }); }
            }
        }
        try { createReferenceEnvironment({ ...map, endPos: null }).replay(baseline.solution.actions); }
        catch { return finish({ accepted: false, reason: 'premature_win' }); }
        return finish({ accepted: true, baseline, trace, noGhost, contrasts, constraints });
    };
}

function proposal(kind, random) {
    const pick = values => values[Math.floor(random() * values.length)];
    const width = pick([3, 4]), height = pick([3, 4]);
    const cells = Array.from({ length: width * height }, (_, i) => [i % width + 1, Math.floor(i / width) + 1]).filter(() => random() > 0.10);
    if (cells.length < 9) return null;
    const positions = [...cells].sort(() => random() - 0.5), start = positions.pop(), end = positions.pop();
    const map = smallMap(cells, start, end, 100);
    const ghostCount = kind === 'arrow' ? 1 : pick([1, 2]);
    map.initialGhosts = Array.from({ length: ghostCount }, (_, id) => { const [x, y] = positions.pop(); return { x, y, id }; });
    const edges = cells.flatMap(([x, y]) => [
        ...(map.activeCells[y][x + 1] ? [{ axis: 'v', x: x + 1, y }] : []),
        ...(map.activeCells[y + 1]?.[x] ? [{ axis: 'h', x, y: y + 1 }] : [])
    ]).sort(() => random() - 0.5);
    for (const edge of edges) if (random() < 0.23) map[edge.axis + 'Walls'][edge.y][edge.x] = { type: W.SOLID, keys: 0 };
    const assign = wall => { const e = edges.pop(); map[e.axis + 'Walls'][e.y][e.x] = wall(e); };
    if (kind === 'arrow') {
        assign(e => ({ type: W.ONE_WAY, keys: 0, direction: e.axis === 'h' ? { dx: 0, dy: pick([-1, 1]) } : { dx: pick([-1, 1]), dy: 0 } }));
        assign(() => ({ type: W.LOCKED, keys: 1 }));
        const [x, y] = positions.pop(); map.items = [{ x, y, type: 'key' }];
    } else {
        assign(() => ({ type: W.LETTER_DOOR, letter: 'A', initialState: pick(['open', 'closed']) }));
        if (random() < 0.6) assign(() => ({ type: W.LETTER_DOOR, letter: 'A', initialState: pick(['open', 'closed']) }));
        const candidates = cells.flatMap(([x, y]) => [[0, -1], [1, 0], [0, 1], [-1, 0]].flatMap(([dx, dy]) =>
            !map.activeCells[y + dy]?.[x + dx] ? [{ x, y, letter: 'A', direction: { dx, dy } }] : []));
        map.buttons = [pick(candidates)];
    }
    if (random() < 0.45) assign(() => ({ type: W.DOOR, keys: 0 }));
    return map;
}

export function explore(kind, iterations, seed, output) {
    const random = seededRandom(seed), evaluate = createEvaluator(kind), accepted = [], counts = {}, started = Date.now();
    let lastProgress = started;
    for (let index = 0; index < iterations; index++) {
        const map = proposal(kind, random); if (!map) continue;
        const result = evaluate(map); counts[result.reason || 'accepted'] = (counts[result.reason || 'accepted'] || 0) + 1;
        if (result.accepted) {
            accepted.push({ index, map, evaluation: result });
            console.log(JSON.stringify({ event: 'candidate', kind, index, cells: map.activeCells.flat().filter(Boolean).length, actions: result.baseline.solution.totalActions, presses: result.trace.presses }));
        }
        if (Date.now() - lastProgress > 25000) { console.log(JSON.stringify({ event: 'progress', kind, index, accepted: accepted.length, counts })); lastProgress = Date.now(); }
        if (accepted.length >= 8) break;
    }
    mkdirSync(resolve(output, '..'), { recursive: true });
    writeFileSync(output, JSON.stringify({ date: '2026-10-08', kind, seed, requestedIterations: iterations, elapsedMs: Date.now() - started, counts, accepted }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ event: 'finished', kind, accepted: accepted.length, counts, output }));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) explore(process.argv[2], Number(process.argv[3]), Number(process.argv[4]), resolve(process.argv[5]));
