import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { smallMap } from '../../src/design/grid.js';
import { seededRandom } from '../../src/design/edits.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment } from '../../src/search/fast-environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { trace } from './discover.mjs';

const directions = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] };
const solid = () => ({ type: W.SOLID, keys: 0 });
const gate = (letter, initialState) => ({ type: W.LETTER_DOOR, letter, initialState });
const cells = [[1, 1], [2, 1], ...Array.from({ length: 16 }, (_, i) => [i % 4 + 1, Math.floor(i / 4) + 2])];
const skeleton = () => {
    const map = smallMap(cells, [2, 5], [1, 1]);
    map.initialGhosts = [{ x: 2, y: 2, id: 0 }, { x: 2, y: 1, id: 1 }];
    map.hWalls[2][1] = solid(); map.vWalls[2][2] = solid(); map.vWalls[2][3] = solid();
    map.hWalls[3][2] = gate('A', 'closed');
    map.vWalls[4][2] = gate('A', 'open');
    map.vWalls[1][2] = gate('B', 'closed');
    map.hWalls[2][2] = gate('B', 'open');
    map.buttons = [{ x: 2, y: 5, letter: 'A', direction: { dx: 0, dy: 1 } },
        { x: 2, y: 1, letter: 'B', direction: { dx: 0, dy: -1 } }];
    return map;
};

// 先独立验证分隔局面，再围绕保留的主干探索旁路。轨迹条件只作人工审查入口。
const gadget = skeleton(), env = createReferenceEnvironment(gadget);
let state = env.initialState();
const gadgetTrace = [];
for (const action of ['D', 'D', 'L', 'U', 'R']) {
    state = env.step(state, action); assert(!state.isDead);
    gadgetTrace.push({ action, player: [state.player.x, state.player.y], ghosts: state.layerStates[0].ghosts.map(g => [g.x, g.y]) });
}
assert.deepEqual(gadgetTrace[1].ghosts, [[2, 4], [2, 2]]);
console.log(JSON.stringify({ event: 'gadget_verified', trace: gadgetTrace }));

const iterations = Number(process.argv[2]), seed = Number(process.argv[3]), output = resolve(process.argv[4]);
const folder = resolve(output, '..'); mkdirSync(folder, { recursive: true });
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
save(resolve(folder, 'gadget.json'), { map: gadget, trace: gadgetTrace, status: 'mechanism_only' });
const random = seededRandom(seed), pick = list => list[Math.floor(random() * list.length)];
const shuffle = list => { list = list.slice(); for (let i = list.length - 1; i; i--) { const j = Math.floor(random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
const options = { nodeBudget: 8000, stateBudget: 11000, budgetMs: 100 };
const counts = {}, accepted = [], started = Date.now(); let last = started;
const count = name => { counts[name] = (counts[name] || 0) + 1; };
for (let index = 0; index < iterations; index++) {
    const map = skeleton();
    const edges = shuffle(cells.flatMap(([x, y]) => [
        ...(map.activeCells[y]?.[x + 1] ? [{ axis: 'v', x: x + 1, y }] : []),
        ...(map.activeCells[y + 1]?.[x] ? [{ axis: 'h', x, y: y + 1 }] : [])
    ]).filter(e => map[e.axis + 'Walls'][e.y][e.x].type === W.EMPTY && !(e.axis === 'h' && e.x === 2)));
    for (const edge of edges) if (random() < 0.3) map[edge.axis + 'Walls'][edge.y][edge.x] = solid();
    for (const letter of ['A', 'B', 'B']) {
        const edge = edges.pop(); map[edge.axis + 'Walls'][edge.y][edge.x] = gate(letter, random() < 0.5 ? 'open' : 'closed');
    }
    const sites = cells.filter(([x, y]) => y > 2 && !(x === 2 && y === 5));
    const buttons = sites.flatMap(([x, y]) => Object.values(directions).flatMap(([dx, dy]) => {
        const axis = dx ? 'v' : 'h', xx = x + (dx === 1 ? 1 : 0), yy = y + (dy === 1 ? 1 : 0);
        return map[axis + 'Walls'][yy][xx].type === W.SOLID ? [{ x, y, letter: 'B', direction: { dx, dy } }] : [];
    }));
    if (!buttons.length) { count('no_button'); continue; }
    map.buttons.push(pick(buttons));
    const solution = solveFastMap(map, options);
    if (solution.status !== 'solved' || solution.optimality !== 'proven') { count(solution.status); continue; }
    const diagnostic = trace(map, solution.solution.actions);
    if (!diagnostic.cuts.length) { count('no_cut'); continue; }
    const cut = diagnostic.cuts[0], suffix = diagnostic.rows.slice(cut.step);
    if (!suffix.some(row => row.button === 'A') || ![0, 1].every(i => suffix.some(row => row.ghosts[i][0] !== cut.after[i][0] || row.ghosts[i][1] !== cut.after[i][1]))) { count('cut_then_done'); continue; }
    const reversed = structuredClone(map); reversed.initialGhosts.reverse();
    try { assert(createFastEnvironment(reversed).reference.replay(solution.solution.actions).state.isWon); }
    catch { count('order_sensitive'); continue; }
    save(resolve(folder, `candidate-${index}.json`), { index, seed, map, solution, trace: diagnostic, humanQuality: null, status: 'awaiting_internal_review' });
    accepted.push(index); count('candidate');
    console.log(JSON.stringify({ event: 'candidate', index, actions: solution.solution.totalActions, word: diagnostic.word, cuts: diagnostic.cuts }));
    if (accepted.length >= 10) break;
    if (Date.now() - last > 20000) { console.log(JSON.stringify({ event: 'progress', index, counts })); last = Date.now(); }
}
save(output, { seed, iterations, counts, accepted, elapsedMs: Date.now() - started, provenance: 'manual_queue_skeleton_random_side_connections' });
console.log(JSON.stringify({ event: 'finished', counts, accepted, elapsedMs: Date.now() - started }));
