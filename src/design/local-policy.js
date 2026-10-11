import { createFastEnvironment } from '../search/fast-environment.js';
import { seededRandom } from './edits.js';
import { WALL_TYPES as W } from '../reference/engine.js';

const DIRECTIONS = [[0, -1, 'U'], [1, 0, 'R'], [0, 1, 'D'], [-1, 0, 'L']];
const key = state => JSON.stringify([
    state.player.x, state.player.y, state.player.keys,
    state.layerStates[0].ghosts.map(g => [g.x, g.y]), state.layerStates[0].items,
    state.layerStates[0].wallStates
]);

// 静态距离只描述当前通路；闭机关按三步代价估计，不搜索开关操作或鬼的未来。
function distance(map, state) {
    const costs = new Map([[`${map.endPos.x},${map.endPos.y}`, 0]]);
    const queue = [[map.endPos.x, map.endPos.y, 0]], walls = state.layerStates[0].wallStates;
    while (queue.length) {
        queue.sort((a, b) => a[2] - b[2]);
        const [x, y, cost] = queue.shift();
        if (cost !== costs.get(`${x},${y}`)) continue;
        for (const [dx, dy] of DIRECTIONS) {
            const nx = x - dx, ny = y - dy;
            if (!map.activeCells[ny]?.[nx]) continue;
            const wall = dx ? walls.v[ny][nx + (dx === 1 ? 1 : 0)] : walls.h[ny + (dy === 1 ? 1 : 0)][nx];
            if ([W.SOLID, W.GLASS].includes(wall.type)) continue;
            if (wall.type === W.ONE_WAY && (wall.direction.dx !== dx || wall.direction.dy !== dy)) continue;
            const extra = wall.type === W.LETTER_DOOR && wall.currentState === 'closed' || wall.type === W.LOCKED && state.player.keys < wall.keys ? 3 : 1;
            const nextCost = cost + extra, cell = `${nx},${ny}`;
            if (nextCost < (costs.get(cell) ?? Infinity)) {
                costs.set(cell, nextCost); queue.push([nx, ny, nextCost]);
            }
        }
    }
    return costs.get(`${state.player.x},${state.player.y}`) ?? 100;
}

/** 有限前瞻、全信息的临场对照。它不调用完整求解器，不冒充人类玩家模型。 */
export function runLocalPolicy(map, { horizon = 3, seed = 11, maxActions = 180 } = {}) {
    if ((map.layerCount ?? 1) !== 1 || map.layers?.length) throw new TypeError('临场对照目前只支持顶层单层图');
    if (!map.endPos || !Number.isInteger(horizon) || horizon < 1 || horizon > 8) throw new TypeError('需要终点和 1–8 步前瞻');
    const env = createFastEnvironment(map), random = seededRandom(seed), visits = new Map(), actions = [], decisions = [];
    let state = env.initialState(), simulated = 0, reason = 'action_limit';
    visits.set(key(state), 1);
    for (let turn = 0; turn < maxActions && !state.isWon; turn++) {
        const candidates = [];
        for (const [, , first] of DIRECTIONS) {
            const next = env.step(state, first); simulated++;
            if (next === state || next.isDead) continue;
            let frontier = [{ state: next, depth: 1 }], best = Infinity;
            const reached = new Set([key(next)]);
            while (frontier.length) {
                const node = frontier.shift(), s = node.state;
                const value = s.isWon ? -100 : distance(map, s) + node.depth * 0.15;
                best = Math.min(best, value);
                if (s.isWon || node.depth === horizon) continue;
                for (const [, , action] of DIRECTIONS) {
                    const after = env.step(s, action); simulated++;
                    if (after === s || after.isDead || reached.has(key(after))) continue;
                    reached.add(key(after)); frontier.push({ state: after, depth: node.depth + 1 });
                }
            }
            // 对实际到过的完整物理状态加惩罚，让策略能临场试探而不只原地循环。
            const repeats = visits.get(key(next)) ?? 0;
            candidates.push({ action: first, value: best + repeats * 2 + random() * 0.01, repeats, next });
        }
        candidates.sort((a, b) => a.value - b.value);
        if (!candidates.length) { reason = 'no_safe_action'; break; }
        const chosen = candidates[0], before = state;
        state = chosen.next; actions.push(chosen.action);
        visits.set(key(state), (visits.get(key(state)) ?? 0) + 1);
        decisions.push({ turn: turn + 1, action: chosen.action, player: [state.player.x, state.player.y], ghosts: state.layerStates[0].ghosts.map(g => [g.x, g.y]),
            button: state.player.x === before.player.x && state.player.y === before.player.y ? map.buttons.find(b => b.x === before.player.x && b.y === before.player.y &&
                DIRECTIONS.some(([dx, dy, action]) => action === chosen.action && b.direction.dx === dx && b.direction.dy === dy))?.letter ?? null : null,
            candidates: candidates.map(({ action, value, repeats }) => ({ action, value, repeats })) });
    }
    if (state.isWon) reason = 'won';
    env.reference.replay(actions);
    return { policy: 'local-current-gates-v1', horizon, seed, maxActions, fullInformation: true, completeSolverUsedForDecisions: false,
        won: state.isWon, reason, totalActions: actions.length, movementCost: env.reference.replay(actions).movementCost, simulated, actions, decisions };
}
