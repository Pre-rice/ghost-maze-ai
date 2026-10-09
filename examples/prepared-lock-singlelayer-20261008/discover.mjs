import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { smallMap } from '../../src/design/grid.js';
import { seededRandom } from '../../src/design/edits.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { createFastEnvironment } from '../../src/search/fast-environment.js';
import { solveContinuation } from '../../src/design/continuation.js';

const directions = [[0, -1, 'U'], [1, 0, 'R'], [0, 1, 'D'], [-1, 0, 'L']];
const edgesOf = map => map.activeCells.flatMap((row, y) => row.flatMap((active, x) => !active ? [] : [
    ...(map.activeCells[y][x + 1] ? [{ axis: 'v', x: x + 1, y }] : []),
    ...(map.activeCells[y + 1]?.[x] ? [{ axis: 'h', x, y: y + 1 }] : [])
]));

// 找真实可执行的直觉前缀：不按按钮，拿钥匙后优先开数字门。
export function earlyUnlock(map, lock, limit = 500) {
    const env = createFastEnvironment(map), initial = env.initialState(), queue = [{ state: initial, actions: [] }], seen = new Set([env.stateKey(initial)]);
    for (let head = 0; head < queue.length && head < limit; head++) {
        const node = queue[head];
        for (const [, , action] of directions) {
            const next = env.step(node.state, action);
            if (next === node.state || next.isDead || next.isWon || next.player.steps === node.state.player.steps) continue;
            const actions = [...node.actions, action];
            if (next.layers[0].wallStates[lock.axis][lock.y][lock.x].type === W.EMPTY) return actions;
            const k = env.stateKey(next);
            if (!seen.has(k)) { seen.add(k); queue.push({ state: next, actions }); }
        }
    }
    return null;
}

const iterations = Number(process.argv[2]), seed = Number(process.argv[3]), output = resolve(process.argv[4]);
const baseFile = process.argv[5], base = baseFile ? JSON.parse(readFileSync(baseFile, 'utf8')) : null;
const random = seededRandom(seed), pick = a => a[Math.floor(random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const budget = { nodeBudget: 6000, stateBudget: 9000, budgetMs: 55 }, counts = {}, accepted = [];
const count = name => { counts[name] = (counts[name] ?? 0) + 1; };
const save = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
mkdirSync(output, { recursive: true }); let last = Date.now();
for (let index = 0; index < iterations; index++) {
    if (Date.now() - last > 25000) { console.log(JSON.stringify({ event: 'progress', index, counts })); last = Date.now(); }
    const width = 4, height = pick([4, 5]);
    const cells = Array.from({ length: width * height }, (_, i) => [i % width + 1, Math.floor(i / width) + 1]).filter(() => random() > 0.06);
    if (cells.length < 14) continue;
    const positions = shuffle(cells), start = positions.pop(), end = positions.pop(), map = smallMap(cells, start, end);
    if (Math.abs(start[0] - end[0]) + Math.abs(start[1] - end[1]) < 3) continue;
    map.initialGhosts = Array.from({ length: index % 3 ? 1 : 2 }, (_, id) => { const [x, y] = positions.pop(); return { x, y, id }; });
    const edges = shuffle(edgesOf(map));
    for (const e of edges) if (random() < 0.28) map[e.axis + 'Walls'][e.y][e.x] = { type: W.SOLID, keys: 0 };
    map.buttons = ['A', 'B'].map(letter => {
        const choices = positions.flatMap(([x, y]) => directions.flatMap(([dx, dy]) => {
            const axis = dx ? 'v' : 'h', xx = x + (dx === 1 ? 1 : 0), yy = y + (dy === 1 ? 1 : 0);
            return map[axis + 'Walls'][yy][xx].type === W.SOLID ? [{ x, y, letter, direction: { dx, dy } }] : [];
        }));
        if (!choices.length) return null;
        const b = pick(choices); positions.splice(positions.findIndex(p => p[0] === b.x && p[1] === b.y), 1); return b;
    });
    if (map.buttons.some(b => !b)) continue;
    const faces = new Set(map.buttons.map(b => `${b.direction.dx ? 'v' : 'h'},${b.x + (b.direction.dx === 1 ? 1 : 0)},${b.y + (b.direction.dy === 1 ? 1 : 0)}`));
    const available = edges.filter(e => !faces.has(`${e.axis},${e.x},${e.y}`));
    const set = wall => { const e = available.pop(); map[e.axis + 'Walls'][e.y][e.x] = wall; return e; };
    const lock = set({ type: W.LOCKED, keys: 1 });
    const [kx, ky] = positions.pop(); map.items = [{ x: kx, y: ky, type: 'key' }];
    for (const letter of ['A', 'B']) for (let n = 0; n < 2; n++) set({ type: W.LETTER_DOOR, letter, initialState: random() < 0.5 ? 'open' : 'closed' });
    set({ type: W.DOOR, keys: 0 });
    if (base) {
        Object.assign(map, structuredClone(base));
        const baseCells = map.activeCells.flatMap((row, y) => row.flatMap((a, x) => a ? [[x, y]] : []));
        const buttonFaces = new Set(map.buttons.map(b => `${b.direction.dx ? 'v' : 'h'},${b.x + (b.direction.dx === 1 ? 1 : 0)},${b.y + (b.direction.dy === 1 ? 1 : 0)}`));
        const choices = edgesOf(map).filter(e => !buttonFaces.has(`${e.axis},${e.x},${e.y}`));
        for (let j = 0; j < index % 3; j++) {
            const e = pick(choices), old = map[e.axis + 'Walls'][e.y][e.x];
            map[e.axis + 'Walls'][e.y][e.x] = old.type === W.LETTER_DOOR ? { ...old, initialState: old.initialState === 'open' ? 'closed' : 'open' } :
                pick([{ type: W.EMPTY, keys: 0 }, { type: W.SOLID, keys: 0 }, { type: W.LETTER_DOOR, letter: pick(['A', 'B']), initialState: pick(['open', 'closed']) }]);
        }
        Object.assign(lock, pick(choices)); map[lock.axis + 'Walls'][lock.y][lock.x] = { type: W.LOCKED, keys: 1 };
        if (index % 2) {
            const e = pick(choices.filter(e => e !== lock && !(e.axis === lock.axis && e.x === lock.x && e.y === lock.y)));
            map[e.axis + 'Walls'][e.y][e.x] = { type: W.ONE_WAY, direction: e.axis === 'h' ? { dx: 0, dy: pick([-1, 1]) } : { dx: pick([-1, 1]), dy: 0 } };
        }
        const [x, y] = pick(baseCells.filter(([x, y]) => !map.initialGhosts.some(g => g.x === x && g.y === y)));
        map.items = [{ x, y, type: 'key' }];
        if (index % 5 === 0) {
            const [x, y] = pick(baseCells.filter(([x, y]) => !(map.startPos.x === x && map.startPos.y === y) && !map.initialGhosts.some(g => g.x === x && g.y === y)));
            map.initialGhosts.push({ x, y, id: 1 });
        }
    }
    const prefix = earlyUnlock(map, lock);
    if (!prefix) { count('no_safe_early_unlock'); continue; }
    const solution = solveFastMap(map, budget);
    if (solution.status !== 'solved' || solution.optimality !== 'proven') { count(solution.status); continue; }
    const env = createFastEnvironment(map); let state = env.initialState(), unlockStep = null, word = [], moved = map.initialGhosts.map(() => 0);
    for (const [i, action] of solution.solution.actions.entries()) {
        const next = env.step(state, action);
        if (state.layers[0].wallStates[lock.axis][lock.y][lock.x].type === W.LOCKED && next.layers[0].wallStates[lock.axis][lock.y][lock.x].type === W.EMPTY) unlockStep = i + 1;
        if (next.player.steps === state.player.steps) word.push({ step: i + 1, letter: map.buttons.find(b => b.x === state.player.x && b.y === state.player.y).letter });
        next.layers[0].ghosts.forEach((g, j) => { if (g.x !== state.layers[0].ghosts[j].x || g.y !== state.layers[0].ghosts[j].y) moved[j]++; }); state = next;
    }
    if (unlockStep === null) { count('lock_avoidable'); continue; }
    if (word.length < 4) { count('few_presses'); continue; }
    if (!word.some(p => p.step < unlockStep) || !word.some(p => p.step > unlockStep)) { count('one_phase'); continue; }
    if (new Set(word.map(p => p.letter)).size !== 2 || moved.some(n => n < 3)) { count('weak_relation'); continue; }
    const premature = solveContinuation(map, prefix, { nodeBudget: 12000, budgetMs: 90 });
    if (premature.status !== 'proven_unsat') { count('early_unlock_' + premature.status); continue; }
    const noGhost = solveFastMap(map, { ...budget, withGhosts: false });
    if (noGhost.status !== 'solved' || solution.solution.totalActions - noGhost.solution.totalActions < 8) { count('weak_ghost'); continue; }
    const opened = { type: 'locked_opened', layer: 0, ...lock }, relations = [];
    for (const letter of ['A', 'B']) if (word.some(p => p.letter === letter && p.step < unlockStep)) {
        const condition = { id: 'prepare_' + letter + '_before_unlock', sequence: [{ type: 'press', letter }, opened] };
        const result = solveFastMap(map, { ...budget, restrictions: [condition] });
        if (result.status === 'proven_unsat') relations.push({ condition, result });
    }
    if (!relations.length) { count('preparation_avoidable'); continue; }
    const entry = { seed, index, baseFile: baseFile ?? null, map, lock, prefix, premature, solution, noGhost, relations, word, moved };
    save(`candidate-${index}.json`, entry); accepted.push(index); count('candidate');
    console.log(JSON.stringify({ event: 'candidate', index, cells: cells.length, actions: solution.solution.totalActions, word, lock, prefix, ghosts: moved.length, relations: relations.map(r => r.condition.id) }));
    if (accepted.length === 6) break;
}
save('search.json', { seed, baseFile: baseFile ?? null, requestedIterations: iterations, counts, accepted, purpose: '提前调整开关后才安全开启一次性数字门；直觉先开门的安全前缀无可完成后缀。' });
console.log(JSON.stringify({ event: 'finished', counts, accepted }));
