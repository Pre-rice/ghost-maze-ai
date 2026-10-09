import { readFileSync } from 'node:fs';
import { WALL_TYPES as W } from '../src/reference/engine.js';
import { createFastEnvironment } from '../src/search/fast-environment.js';

const input = JSON.parse(readFileSync(process.argv[2], 'utf8')), map = input.map ?? input;
const active = map.activeCells.flatMap((row, y) => row.flatMap((v, x) => v ? [[x, y]] : []));
const minX = Math.min(...active.map(p => p[0])), maxX = Math.max(...active.map(p => p[0]));
const minY = Math.min(...active.map(p => p[1])), maxY = Math.max(...active.map(p => p[1]));
const wall = (w, axis) => w.type === W.EMPTY ? ' ' : w.type === W.SOLID ? (axis === 'h' ? '-' : '|') :
    w.type === W.LETTER_DOOR ? w.initialState === 'open' ? w.letter.toLowerCase() : w.letter :
    w.type === W.LOCKED ? String(w.keys) : w.type === W.DOOR ? 'd' : w.type === W.ONE_WAY ? '>' : '?';
const entity = (x, y) => !map.activeCells[y]?.[x] ? '   ' : map.startPos.x === x && map.startPos.y === y ? ' P ' :
    map.endPos.x === x && map.endPos.y === y ? ' E ' : map.initialGhosts.find(g => g.x === x && g.y === y) ? ' G ' :
    map.items.find(k => k.x === x && k.y === y) ? ' K ' : map.buttons.find(b => b.x === x && b.y === y) ? `[${map.buttons.find(b => b.x === x && b.y === y).letter}]` : ' . ';
console.log('    ' + Array.from({ length: maxX - minX + 1 }, (_, i) => ` ${minX + i}  `).join(''));
for (let y = minY; y <= maxY + 1; y++) {
    console.log('    +' + Array.from({ length: maxX - minX + 1 }, (_, i) => wall(map.hWalls[y][minX + i], 'h').repeat(3)).join('+') + '+');
    if (y <= maxY) console.log(`${y}   ` + Array.from({ length: maxX - minX + 1 }, (_, i) => wall(map.vWalls[y][minX + i], 'v') + entity(minX + i, y)).join('') + wall(map.vWalls[y][maxX + 1], 'v'));
}
console.log(JSON.stringify({ start: map.startPos, goal: map.endPos, ghosts: map.initialGhosts, buttons: map.buttons, key: map.items, lock: input.lock, prefix: input.prefix }));
const actions = input.solution?.solution?.actions;
if (actions) {
    const env = createFastEnvironment(map); let state = env.initialState();
    for (const [i, action] of actions.entries()) {
        const next = env.step(state, action), pressed = next.player.steps === state.player.steps;
        const gates = ['h', 'v'].flatMap(axis => map[axis + 'Walls'].flatMap((row, y) => row.flatMap((w, x) => w.type === W.LETTER_DOOR ?
            [`${w.letter}${axis}${x},${y}:${next.layers[0].wallStates[axis][y][x].currentState[0]}`] : [])));
        const unlocked = input.lock && state.layers[0].wallStates[input.lock.axis][input.lock.y][input.lock.x].type !== next.layers[0].wallStates[input.lock.axis][input.lock.y][input.lock.x].type;
        const [dx, dy] = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] }[action];
        console.log(`${String(i + 1).padStart(2)} ${action}${pressed ? ':' + map.buttons.find(b => b.x === state.player.x && b.y === state.player.y && b.direction.dx === dx && b.direction.dy === dy).letter : '  '} P(${next.player.x},${next.player.y}) G[${next.layers[0].ghosts.map(g => `${g.x},${g.y}`).join(';')}] ${gates.join(' ')}${unlocked ? ' 开锁' : ''}`);
        state = next;
    }
}
