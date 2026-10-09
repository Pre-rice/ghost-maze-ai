import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { smallMap } from '../../src/design/grid.js';
import { seededRandom } from '../../src/design/edits.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { createFastEnvironment } from '../../src/search/fast-environment.js';
import { trace } from './discover.mjs';

const solid = () => ({ type: W.SOLID, keys: 0 });
const gate = (letter, initialState) => ({ type: W.LETTER_DOOR, letter, initialState });
const cells = [[0, 1], ...Array.from({ length: 20 }, (_, i) => [i % 4 + 1, Math.floor(i / 4) + 1])];
const iterations = Number(process.argv[2]), seed = Number(process.argv[3]), output = resolve(process.argv[4]);
const folder = resolve(output, '..'); mkdirSync(folder, { recursive: true });
const save = (name, data) => writeFileSync(resolve(folder, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const random = seededRandom(seed), pick = a => a[Math.floor(random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const budget = { nodeBudget: 20000, stateBudget: 24000, budgetMs: 200 };
const mode = process.argv[5] ?? 'interleaved';
const variant = process.argv[6] ?? 'upper_station';
const counts = {}, accepted = [], start = Date.now(); let last = start;
const count = name => { counts[name] = (counts[name] || 0) + 1; };
for (let index = 0; index < iterations; index++) {
    if (Date.now() - last > 20000) { console.log(JSON.stringify({ event: 'progress', index, counts })); last = Date.now(); }
    const map = smallMap(cells, [2, 5], [0, 1]);
    map.initialGhosts = [{ x: 1, y: 1, id: 0 }, { x: 2, y: 2, id: 1 }];
    map.hWalls[2][1] = solid(); map.hWalls[2][3] = solid();
    map.vWalls[2][2] = solid(); map.vWalls[2][3] = solid();
    map.vWalls[1][2] = gate('B', 'closed'); map.hWalls[2][2] = gate('B', 'open');
    map.vWalls[1][3] = gate('A', 'open'); map.hWalls[3][2] = gate('A', 'closed');
    map.hWalls[2][4] = gate('A', 'open');
    map.vWalls[1][1] = gate('A', 'closed');
    map.buttons = [{ x: 2, y: 5, letter: 'A', direction: { dx: 0, dy: 1 } },
        { x: 2, y: 1, letter: 'B', direction: { dx: 0, dy: -1 } },
        { x: 3, y: 1, letter: 'B', direction: { dx: 0, dy: -1 } }];
    const fixed = new Set(['h,1,2', 'h,3,2', 'v,2,2', 'v,3,2']);
    const edges = shuffle(cells.flatMap(([x, y]) => [
        ...(map.activeCells[y]?.[x + 1] ? [{ axis: 'v', x: x + 1, y }] : []),
        ...(map.activeCells[y + 1]?.[x] ? [{ axis: 'h', x, y: y + 1 }] : [])
    ]).filter(e => !fixed.has(`${e.axis},${e.x},${e.y}`) && map[e.axis + 'Walls'][e.y][e.x].type === W.EMPTY && !(e.axis === 'h' && e.x === 2)));
    for (const e of edges) if (random() < 0.35) map[e.axis + 'Walls'][e.y][e.x] = solid();
    for (const letter of ['A', 'B', 'B']) {
        const e = edges.pop(); map[e.axis + 'Walls'][e.y][e.x] = gate(letter, random() < 0.5 ? 'open' : 'closed');
    }
    if (variant === 'remote_station') {
        const [x, y, dx] = pick([[1, 3, -1], [1, 4, -1], [1, 5, -1], [4, 3, 1], [4, 4, 1], [4, 5, 1]]);
        map.buttons[2] = { x, y, letter: 'B', direction: { dx, dy: 0 } };
    }
    const solution = solveFastMap(map, budget);
    if (solution.status !== 'solved' || solution.optimality !== 'proven') { count(solution.status); continue; }
    const diagnostic = trace(map, solution.solution.actions);
    const wordMatches = mode === 'all' || (mode === 'integrated' ? /B.*A.*B/.test(diagnostic.word) : mode === 'staged' ? /BA{2,}B/.test(diagnostic.word) : /B.*A.*B.*A|A.*B.*A.*B/.test(diagnostic.word));
    if ((mode !== 'all' && diagnostic.moves.some(n => n === 0)) || !wordMatches) { count('weak_relation'); continue; }
    const changed = structuredClone(map); changed.initialGhosts.reverse();
    try { if (!createFastEnvironment(changed).reference.replay(solution.solution.actions).state.isWon) { count('order_sensitive'); continue; } }
    catch { count('order_sensitive'); continue; }
    save(`candidate-${index}.json`, { index, seed, map, solution, trace: diagnostic, humanQuality: null, status: 'awaiting_internal_review' });
    count('candidate'); accepted.push(index);
    console.log(JSON.stringify({ event: 'candidate', index, actions: solution.solution.totalActions, word: diagnostic.word, moves: diagnostic.moves }));
    if (accepted.length >= 8) break;
}
save('summary.json', { seed, iterations, mode, variant, counts, accepted, elapsedMs: Date.now() - start,
    provenance: 'manual_two_occupied_goal_and_approach_with_shared_complementary_gates' });
console.log(JSON.stringify({ event: 'finished', counts, accepted, elapsedMs: Date.now() - start }));
