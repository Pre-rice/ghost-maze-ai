import { WALL_TYPES } from '../engine/constants.js';
import { DIRS4, wallBetween } from './wallIndex.js';
import { makeSimulator, createInitState, step, stateKey, isWin } from './simulator.js';

/**
 * solvabilityVerifier 模块 - 结构可解性验证 + 求解器启发式
 *
 * 两层用途：
 * 1. `isStructurallySolvable`：无鬼模式 BFS，判定"存在一条从起点到任一终点、
 *    满足全部钥匙约束（LOCKED 需先集齐钥匙）的路径"——生成器的快速筛选闸门。
 * 2. `relaxedDistField`：忽略鬼、放宽 LOCKED/ONE_WAY/字母门约束的 BFS 距离场，
 *    用作求解器 A* 的严格下界启发式（下界性：放宽只会让边更容易通行，距离只减不增）。
 *
 * 注意（第一版限制）：距离场只计算当前层的终点，跨层胜利时启发式非下界、
 * 可能破坏最优性——生成器固定单层，多层求解在阶段 7 扩展。
 */

/**
 * 到本层终点的放宽 BFS 距离场
 * @param {object} sim - makeSimulator 返回值
 * @returns {Array<Array<number>>[]} fields：每层一个 height×width 距离矩阵（Infinity = 不可达）
 */
export function relaxedDistField(sim) {
    const fields = [];
    for (let li = 0; li < sim.layerCount; li++) {
        const layer = sim.layers[li];
        const end = layer.endPos;
        const field = Array(sim.height).fill(null).map(() => Array(sim.width).fill(Infinity));
        if (!end) {
            fields.push(field);
            continue;
        }
        // 从终点反向扩散：检查 (x,y) 朝 (dx,dy) 的墙（与 (nx,ny)→(x,y) 的墙是同一面）
        const queue = [{ x: end.x, y: end.y, d: 0 }];
        field[end.y][end.x] = 0;
        const visited = new Set([`${end.x},${end.y}`]);
        while (queue.length > 0) {
            const { x, y, d } = queue.shift();
            for (const { dx, dy } of DIRS4) {
                const nx = x + dx;
                const ny = y + dy;
                const key = `${nx},${ny}`;
                if (nx < 0 || nx >= sim.width || ny < 0 || ny >= sim.height) continue;
                if (visited.has(key)) continue;
                if (!layer.activeCells[ny][nx]) continue;
                const wall = wallBetween(x, y, dx, dy, layer.hWalls, layer.vWalls);
                if (wall) {
                    // SOLID/GLASS 不可穿；LOCKED/ONE_WAY/字母门/DOOR 放宽可穿（下界性来源）
                    if (wall.type === WALL_TYPES.SOLID || wall.type === WALL_TYPES.GLASS) continue;
                }
                visited.add(key);
                field[ny][nx] = d + 1;
                queue.push({ x: nx, y: ny, d: d + 1 });
            }
        }
        fields.push(field);
    }
    return fields;
}

/**
 * 结构可解判定：无鬼模式下存在满足钥匙约束的起点→终点路径（BFS，全量）
 * @param {object} mapData - 地图数据
 * @returns {boolean}
 */
export function isStructurallySolvable(mapData) {
    const sim = makeSimulator(mapData, { withGhosts: false });
    const start = createInitState(sim);
    const queue = [start];
    const seen = new Set([stateKey(start, sim, { withGhosts: false })]);
    let nodes = 0;

    while (queue.length > 0) {
        const s = queue.shift();
        nodes++;
        if (isWin(s, sim)) return true;
        for (const { dx, dy } of DIRS4) {
            const ns = step(s, { type: 'MOVE', payload: { dx, dy } }, sim);
            if (ns === s) continue;
            const k = stateKey(ns, sim, { withGhosts: false });
            if (!seen.has(k)) {
                seen.add(k);
                queue.push(ns);
            }
        }
    }
    return false;
}
