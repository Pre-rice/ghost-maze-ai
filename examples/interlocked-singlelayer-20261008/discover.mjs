import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { smallMap } from '../../src/design/grid.js';
import { seededRandom } from '../../src/design/edits.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { createFastEnvironment } from '../../src/search/fast-environment.js';

// 指标只缩小人工审查范围；多按按钮、走得更长不自动代表巧妙。
export function trace(map, actions) {
    const env = createFastEnvironment(map), word = [], rows = [], moves = map.initialGhosts.map(() => 0);
    let state = env.initialState();
    for (const [index, action] of actions.entries()) {
        const next = env.step(state, action);
        const button = next.player.steps === state.player.steps ? map.buttons.find(b => b.x === state.player.x && b.y === state.player.y) : null;
        if (button) word.push(button.letter);
        next.layers[0].ghosts.forEach((g, i) => { if (g.x !== state.layers[0].ghosts[i].x || g.y !== state.layers[0].ghosts[i].y) moves[i]++; });
        rows.push({ index: index + 1, action, button: button?.letter ?? null, player: [next.player.x, next.player.y], ghosts: next.layers[0].ghosts.map(g => [g.x, g.y]), keys: next.player.keys });
        state = next;
    }
    return { word, moves, rows };
}

export function discover(iterations, seed, output) {
    const random = seededRandom(seed), pick = a => a[Math.floor(random() * a.length)];
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const budget = { nodeBudget: 4500, stateBudget: 6500, budgetMs: 65 };
    const accepted = [], counts = {}, started = Date.now(); let lastProgress = started, longest = null;
    const count = name => { counts[name] = (counts[name] || 0) + 1; };
    for (let index = 0; index < iterations; index++) {
        if (Date.now() - lastProgress > 25000) { console.log(JSON.stringify({ event: 'progress', index, counts })); lastProgress = Date.now(); }
        const kind = index % 2 ? 'lock' : 'dual';
        const width = 4, height = pick([4, 5]), exitY = pick([2, 3]);
        const cells = Array.from({ length: width * height }, (_, i) => [i % width + 1, Math.floor(i / width) + 1]).filter(([x, y]) => x === width && Math.abs(y - exitY) <= 1 || random() > 0.04);
        if (cells.length < 15) continue;
        const positions = shuffle(cells.filter(([x,y]) => !(x === width && y === exitY))), start = positions.pop(), end = [width + 1, exitY];
        cells.push(end);
        if (Math.abs(start[0] - end[0]) + Math.abs(start[1] - end[1]) < 3) continue;
        const map = smallMap(cells, start, end);
        map.initialGhosts = [{ x: width, y: exitY, id: 0 }];
        if (kind === 'dual') { const [x,y] = positions.pop(); map.initialGhosts.push({x,y,id:1}); }
        const edges = shuffle(cells.flatMap(([x, y]) => [
            ...(map.activeCells[y][x + 1] ? [{ axis: 'v', x: x + 1, y }] : []),
            ...(map.activeCells[y + 1]?.[x] ? [{ axis: 'h', x, y: y + 1 }] : [])
        ]));
        for (const e of edges) if (random() < 0.32) map[e.axis + 'Walls'][e.y][e.x] = { type: W.SOLID, keys: 0 };
        map.vWalls[exitY][width] = { type: W.SOLID, keys: 0 };
        map.vWalls[exitY][width + 1] = { type: W.EMPTY, keys: 0 };
        map.hWalls[exitY][width] = { type: W.LETTER_DOOR, letter: 'A', initialState: 'closed' };
        map.hWalls[exitY + 1][width] = { type: W.LETTER_DOOR, letter: 'B', initialState: 'closed' };
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        map.buttons = ['A', 'B'].map(letter => {
            const candidates = positions.flatMap(([x, y]) => directions.flatMap(([dx, dy]) => {
                const axis = dx ? 'v' : 'h', xx = x + (dx === 1 ? 1 : 0), yy = y + (dy === 1 ? 1 : 0);
                return map[axis + 'Walls'][yy][xx].type === W.SOLID ? [{ x, y, letter, direction: { dx, dy } }] : [];
            }));
            if (!candidates.length) return null;
            const button = pick(candidates); positions.splice(positions.findIndex(p => p[0] === button.x && p[1] === button.y), 1); return button;
        });
        if (map.buttons.some(b => !b)) continue;
        const occupiedButtons = new Set(map.buttons.map(b => {
            const d = b.direction; return `${d.dx ? 'v' : 'h'},${b.x + (d.dx === 1 ? 1 : 0)},${b.y + (d.dy === 1 ? 1 : 0)}`;
        }));
        const reserved = new Set([`v,${width},${exitY}`, `v,${width+1},${exitY}`, `h,${width},${exitY}`, `h,${width},${exitY+1}`]);
        const available = edges.filter(e => !occupiedButtons.has(`${e.axis},${e.x},${e.y}`) && !reserved.has(`${e.axis},${e.x},${e.y}`));
        const set = wall => { const e = available.pop(); if (e) map[e.axis + 'Walls'][e.y][e.x] = wall; };
        for (const letter of ['A', 'B']) for (let n = 0; n < 2; n++) set({ type: W.LETTER_DOOR, letter, initialState: random() < 0.5 ? 'open' : 'closed' });
        if (random() < 0.6) set({ type: W.DOOR, keys: 0 });
        if (kind === 'lock') {
            set({ type: W.LOCKED, keys: 1 });
            const [x, y] = positions.pop(); map.items = [{ x, y, type: 'key' }];
        }
        const result = solveFastMap(map, budget);
        if (result.status !== 'solved' || result.optimality !== 'proven') { count(result.status); continue; }
        const t = trace(map, result.solution.actions), word = t.word.join('');
        if (!longest || result.solution.totalActions > longest.solution.solution.totalActions) longest = {index,kind,map,solution:result,trace:t};
        if (result.solution.totalActions < 28 || result.solution.totalActions > 70 || t.word.filter(x => x === 'A').length < 2 || t.word.filter(x => x === 'B').length < 2 || !/A.*B.*A/.test(word) || !/B.*A.*B/.test(word) || t.moves.some(n => n < 4)) { count('weak_sequence'); continue; }
        const noGhost = solveFastMap(map, { ...budget, withGhosts: false });
        if (noGhost.status !== 'solved' || noGhost.optimality !== 'proven' || result.solution.totalActions - noGhost.solution.totalActions < 10) { count('weak_ghost_effect'); continue; }
        if (kind === 'lock' && !t.rows.some(r => r.keys)) { count('key_unused'); continue; }
        const entry = { index, kind, map, solution: result, noGhost, trace: t };
        accepted.push(entry); count('candidate');
        mkdirSync(resolve(output, '..'), { recursive: true });
        writeFileSync(resolve(output, '..', `candidate-${index}.json`), JSON.stringify(entry, null, 2) + '\n', { flag: 'wx' });
        console.log(JSON.stringify({ event: 'candidate', index, kind, cells: cells.length, actions: result.solution.totalActions, noGhost: noGhost.solution.totalActions, word, moves: t.moves }));
        if (accepted.length >= 10) break;
    }
    mkdirSync(resolve(output, '..'), { recursive: true });
    if (longest) writeFileSync(resolve(output, '..', 'longest-diagnostic.json'), JSON.stringify(longest,null,2)+'\n',{flag:'wx'});
    writeFileSync(output, JSON.stringify({ date: '2026-10-08', seed, requestedIterations: iterations, counts, elapsedMs: Date.now() - started, accepted: accepted.map(e => e.index) }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ event: 'finished', counts, output }));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) discover(Number(process.argv[2]), Number(process.argv[3]), resolve(process.argv[4]));
