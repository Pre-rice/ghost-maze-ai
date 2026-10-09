import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { smallMap } from '../../src/design/grid.js';
import { seededRandom } from '../../src/design/edits.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { createFastEnvironment } from '../../src/search/fast-environment.js';

const direction = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] };
const pair = (axis, x, y) => axis === 'h' ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]];
const at = (ghost, p) => ghost.x === p[0] && ghost.y === p[1];

// 此诊断寻找同一开关按时间隔开两只鬼的提案，不给趣味打分。
export function trace(map, actions) {
    const env = createFastEnvironment(map), rows = [], cuts = [], moves = [0, 0];
    let state = env.initialState();
    for (const [index, action] of actions.entries()) {
        const next = env.step(state, action), [dx, dy] = direction[action];
        const button = next.player.steps === state.player.steps ? map.buttons.find(b => b.x === state.player.x && b.y === state.player.y && b.direction.dx === dx && b.direction.dy === dy) : null;
        const changes = [];
        for (const axis of ['h', 'v']) state.layers[0].wallStates[axis].forEach((row, y) => row.forEach((wall, x) => {
            if (wall.type !== W.LETTER_DOOR || wall.currentState === next.layers[0].wallStates[axis][y][x].currentState) return;
            const change = { axis, x, y, letter: wall.letter, state: next.layers[0].wallStates[axis][y][x].currentState };
            changes.push(change);
            const ends = pair(axis, x, y), ghosts = state.layers[0].ghosts;
            if (change.state === 'closed' && ends.every(p => ghosts.some(g => at(g, p)))) cuts.push({ step: index + 1, ...change, player: [state.player.x, state.player.y], before: ghosts.map(g => [g.x, g.y]), after: next.layers[0].ghosts.map(g => [g.x, g.y]) });
        }));
        next.layers[0].ghosts.forEach((g, i) => { if (g.x !== state.layers[0].ghosts[i].x || g.y !== state.layers[0].ghosts[i].y) moves[i]++; });
        rows.push({ step: index + 1, action, button: button?.letter ?? null, player: [next.player.x, next.player.y], ghosts: next.layers[0].ghosts.map(g => [g.x, g.y]), changes });
        state = next;
    }
    return { rows, cuts, moves, word: rows.filter(r => r.button).map(r => r.button).join('') };
}

export function discover(iterations, seed, output) {
    const random = seededRandom(seed), pick = a => a[Math.floor(random() * a.length)];
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const budget = { nodeBudget: 4500, stateBudget: 7500, budgetMs: 60 };
    const counts = {}, accepted = [], started = Date.now(); let lastProgress = started;
    const count = name => { counts[name] = (counts[name] || 0) + 1; };
    const folder = resolve(output, '..'); mkdirSync(folder, { recursive: true });
    for (let index = 0; index < iterations; index++) {
        if (Date.now() - lastProgress > 20000) { console.log(JSON.stringify({ event: 'progress', index, counts })); lastProgress = Date.now(); }
        const height = pick([4, 5]), exitY = pick([2, 3]), width = 4;
        const core = Array.from({ length: width * height }, (_, i) => [i % width + 1, Math.floor(i / width) + 1]);
        const end = [5, exitY], first = [4, exitY], start = pick(core.filter(([x, y]) => x <= 2 && y >= height - 1));
        const second = pick(core.filter(([x, y]) => x <= 2 && Math.abs(x - start[0]) + Math.abs(y - start[1]) >= 2));
        const map = smallMap([...core, end], start, end);
        map.initialGhosts = [first, second].map(([x, y], id) => ({ x, y, id }));
        const edges = shuffle(core.flatMap(([x, y]) => [
            ...(x < width ? [{ axis: 'v', x: x + 1, y }] : []),
            ...(y < height ? [{ axis: 'h', x, y: y + 1 }] : [])
        ]));
        for (const e of edges) if (random() < 0.26) map[e.axis + 'Walls'][e.y][e.x] = { type: W.SOLID, keys: 0 };
        map.vWalls[exitY][4] = { type: W.SOLID, keys: 0 };
        map.hWalls[exitY][4] = { type: W.LETTER_DOOR, letter: 'A', initialState: 'closed' };
        map.hWalls[exitY + 1][4] = { type: W.LETTER_DOOR, letter: 'B', initialState: 'closed' };
        const reserved = new Set([`v,4,${exitY}`, `h,4,${exitY}`, `h,4,${exitY + 1}`]);
        const available = edges.filter(e => !reserved.has(`${e.axis},${e.x},${e.y}`));
        for (const letter of ['A', 'B']) for (let n = 0; n < 2; n++) {
            const e = available.pop(); map[e.axis + 'Walls'][e.y][e.x] = { type: W.LETTER_DOOR, letter, initialState: random() < 0.5 ? 'open' : 'closed' };
        }
        if (random() < 0.35) { const e = available.pop(); map[e.axis + 'Walls'][e.y][e.x] = { type: W.DOOR, keys: 0 }; }
        const occupied = [start, first, second, end];
        const sites = core.filter(p => !occupied.some(q => p[0] === q[0] && p[1] === q[1]));
        const letters = ['A', 'B'];
        for (const letter of letters) {
            const preferred = letter === 'B' ? sites.filter(([x, y]) => x >= 3 && y >= exitY + 1) : sites.filter(([x, y]) => x <= 3);
            const candidates = (preferred.length ? preferred : sites).flatMap(([x, y]) => Object.values(direction).flatMap(([dx, dy]) => {
                const axis = dx ? 'v' : 'h', xx = x + (dx === 1 ? 1 : 0), yy = y + (dy === 1 ? 1 : 0);
                return map[axis + 'Walls'][yy][xx].type === W.SOLID ? [{ x, y, letter, direction: { dx, dy } }] : [];
            }));
            if (!candidates.length) break;
            const button = pick(candidates); map.buttons.push(button);
            sites.splice(sites.findIndex(p => p[0] === button.x && p[1] === button.y), 1);
        }
        if (map.buttons.length !== 2) { count('no_button_site'); continue; }
        const solution = solveFastMap(map, budget);
        if (solution.status !== 'solved' || solution.optimality !== 'proven') { count(solution.status); continue; }
        const diagnostic = trace(map, solution.solution.actions);
        if (!diagnostic.cuts.length) { count('no_cut'); continue; }
        if (diagnostic.moves.some(n => n < 3) || !/A.*B.*A|B.*A.*B/.test(diagnostic.word)) { count('weak_relation'); continue; }
        // 隔开后还需操作并移动两只鬼，排除把第二只鬼独立关进房间便结束。
        const cut = diagnostic.cuts[0], suffix = diagnostic.rows.slice(cut.step);
        if (!suffix.some(r => r.button) || ![0, 1].every(i => suffix.some(r => r.ghosts[i][0] !== cut.after[i][0] || r.ghosts[i][1] !== cut.after[i][1]))) { count('ends_after_cut'); continue; }
        const reversed = structuredClone(map); reversed.initialGhosts.reverse();
        try { if (!createFastEnvironment(reversed).reference.replay(solution.solution.actions).state.isWon) { count('order_sensitive'); continue; } }
        catch { count('order_sensitive'); continue; }
        const entry = { index, seed, map, solution, trace: diagnostic, status: 'awaiting_internal_review', humanQuality: null };
        writeFileSync(resolve(folder, `candidate-${index}.json`), JSON.stringify(entry, null, 2) + '\n', { flag: 'wx' });
        accepted.push(index); count('candidate');
        console.log(JSON.stringify({ event: 'candidate', index, actions: solution.solution.totalActions, word: diagnostic.word, moves: diagnostic.moves, cuts: diagnostic.cuts }));
        if (accepted.length >= 6) break;
    }
    const summary = { date: '2026-10-09', seed, requestedIterations: iterations, counts, accepted, elapsedMs: Date.now() - started, modelUsed: false };
    writeFileSync(output, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ event: 'finished', ...summary }));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) discover(Number(process.argv[2]), Number(process.argv[3]), resolve(process.argv[4]));
