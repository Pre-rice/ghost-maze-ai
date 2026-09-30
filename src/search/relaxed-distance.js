import { WALL_TYPES as W } from '../reference/engine.js';
import { DIRS4, wallBetween } from '../validate/wallIndex.js';

/** 所有层终点的多源反向 BFS；放宽动态门、单向限制和按钮占用，保留实墙、玻璃与活动格。 */
export function relaxedDistField(sim) {
    const fields = sim.layers.map(() => Array.from({ length: sim.height }, () => Array(sim.width).fill(Infinity)));
    const queue = [];
    for (let layer = 0; layer < sim.layerCount; layer++) {
        const end = sim.layers[layer].endPos;
        if (end) { fields[layer][end.y][end.x] = 0; queue.push({ layer, x: end.x, y: end.y }); }
    }
    const stairs = new Map();
    if (sim.multiLayer) for (const stair of sim.stairs) {
        const target = stair.layer + (stair.direction === 'up' ? 1 : -1);
        const paired = sim.stairs.find(other => other.layer === target && other.x === stair.x && other.y === stair.y && other.direction === (stair.direction === 'up' ? 'down' : 'up'));
        if (paired) stairs.set(`${stair.layer},${stair.x},${stair.y}`, paired);
    }
    for (let head = 0; head < queue.length; head++) {
        const { layer, x, y } = queue[head], def = sim.layers[layer];
        const visit = (li, nx, ny) => {
            if (nx < 0 || ny < 0 || nx >= sim.width || ny >= sim.height || !sim.layers[li]?.activeCells[ny][nx] || fields[li][ny][nx] !== Infinity) return;
            fields[li][ny][nx] = fields[layer][y][x] + 1;
            queue.push({ layer: li, x: nx, y: ny });
        };
        for (const { dx, dy } of DIRS4) {
            const wall = wallBetween(x, y, dx, dy, def.hWalls, def.vWalls);
            if (wall?.type !== W.SOLID && wall?.type !== W.GLASS) visit(layer, x + dx, y + dy);
        }
        const paired = stairs.get(`${layer},${x},${y}`);
        if (paired) visit(paired.layer, x, y);
    }
    return fields;
}
