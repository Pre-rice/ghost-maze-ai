import { readFileSync, writeFileSync } from 'node:fs';
import { minimizeDesign } from '../../src/design/minimize.js';
import { createEvaluator, walls } from './explore.mjs';
import { WALL_TYPES as W } from '../../src/reference/engine.js';

const run = JSON.parse(readFileSync(process.argv[2], 'utf8')), evaluate = createEvaluator(run.kind);
for (const item of run.accepted) {
    if (!evaluate(item.map).accepted) { console.log(JSON.stringify({ index: item.index, rejected: evaluate(item.map).reason })); continue; }
    const result = minimizeDesign(item.map, evaluate), map = result.map, e = result.evaluation;
    const symbols = Array.from({ length: 8 }, () => Array(8).fill(' '));
    map.activeCells.forEach((row, y) => row.forEach((active, x) => { if (active) symbols[y][x] = '.'; }));
    for (const p of map.items) symbols[p.y][p.x] = 'K';
    for (const p of map.buttons) symbols[p.y][p.x] = 'A';
    for (const [i, p] of map.initialGhosts.entries()) symbols[p.y][p.x] = String(i);
    symbols[map.startPos.y][map.startPos.x] = 'S'; symbols[map.endPos.y][map.endPos.x] = 'E';
    const summary = { index: item.index, complexity: result.complexity, actions: e.baseline.solution.actions.join(''), noGhostActions: e.noGhost.solution.totalActions,
        presses: e.trace.presses, layout: symbols.map(row => row.join('')).filter(row => row.trim()),
        walls: walls(map).filter(({ axis, x, y, wall }) => wall.type !== W.EMPTY && (axis === 'h' ? map.activeCells[y - 1]?.[x] : map.activeCells[y]?.[x - 1]) && map.activeCells[y]?.[x]),
        trace: e.trace.rows, unresolved: result.localMinimality.unresolved };
    writeFileSync(process.argv[2] + '.min-' + item.index + '.json', JSON.stringify({ kind: run.kind, seed: run.seed, index: item.index, source: item.map, minimized: result }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(summary));
}
