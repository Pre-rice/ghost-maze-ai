import { createReferenceEnvironment } from '../reference/environment.js';
import { WALL_TYPES as W } from '../reference/engine.js';
import { enumeratePlanningGraph } from '../training/planning-graph.js';

const defaults = { nodeBudget: 250000, stateBudget: 250000, budgetMs: 60000, candidateBudget: 3000 };
const cellKey = player => [player.layer, player.x, player.y].join(',');
const sortedItems = items => items.map(item => [item.x, item.y, item.type])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0] || String(a[2]).localeCompare(String(b[2])));

function stateLabel(state, doors) {
    return {
        ghosts: state.layerStates.map(layer => layer.ghosts.map(ghost => [ghost.x, ghost.y])
            .sort((a, b) => a[0] - b[0] || a[1] - b[1])),
        doors: doors.map(position => {
            const wall = state.layerStates[position.layer].wallStates[position.axis][position.y][position.x];
            return { ...position, type: wall.type, letter: wall.letter ?? null, state: wall.currentState ?? null };
        }),
        items: state.layerStates.map(layer => sortedItems(layer.items)),
        keys: state.player.keys,
        hp: state.player.hp
    };
}

/** 穷尽后提取稳定安排及首次出现顺序；不提供趣味分，也不是求解前的目标选择器。 */
export function analyzeArrangements(map, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('分析预算必须为对象');
    for (const key of Object.keys(options)) if (!Object.hasOwn(defaults, key)) throw new TypeError(`未知分析预算：${key}`);
    const budget = { ...defaults, ...options };
    for (const [key, value] of Object.entries(budget)) {
        if (!Number.isSafeInteger(value) || value < (key === 'stateBudget' ? 1 : 0)) throw new TypeError(`非法分析预算：${key}`);
    }
    const env = createReferenceEnvironment(map);
    if (!env.mapDefinition.layers.some(layer => layer.initialEntities.endPos)) throw new TypeError('安排分析需要终点');
    const started = Date.now(), expired = () => Date.now() - started >= budget.budgetMs;
    const base = { analysisVersion: 'stable-arrangements-v1', mapId: env.mapId, ruleset: env.ruleset,
        scope: '全信息、无伤无复活；原图全部通关允许非致死鬼重合；仅目标状态排除重合',
        orderScope: '必要安排的首次出现顺序，不声称以后不能回访',
        qualityScore: null, budget };
    const unknown = reason => ({ ...base, status: 'unknown', reason });
    if (!budget.budgetMs || !budget.nodeBudget) return unknown('budget');
    const graph = enumeratePlanningGraph(map, budget);
    if (graph.status !== 'exhausted') return unknown(graph.reason);
    if (!Number.isFinite(graph.distance[0])) return { ...base, status: 'base_unsat', reason: 'no_zero_hit_solution' };
    const doors = [];
    // 可变门位置来自已校验的引擎初态，不从标题、参考解或设计说明推断。
    graph.env.initialState().layerStates.forEach((layer, z) => {
        for (const axis of ['h', 'v']) layer.wallStates[axis].forEach((row, y) => row.forEach((wall, x) => {
            if ([W.LETTER_DOOR, W.LOCKED].includes(wall.type)) doors.push({ layer: z, axis, x, y });
        }));
    });
    const groups = [], byLabel = new Map();
    const nodeGroup = graph.nodes.map(node => {
        const data = stateLabel(node.state, doors), key = JSON.stringify(data);
        let id = byLabel.get(key);
        if (id === undefined) {
            id = groups.length; byLabel.set(key, id);
            groups.push({ id, data, nodes: [], overlap: node.overlap });
        }
        return id;
    });
    const quiet = graph.nodes.map(() => []), reverse = graph.nodes.map(() => []);
    graph.nodes.forEach((node, i) => {
        groups[nodeGroup[i]].nodes.push(i);
        if (!Number.isFinite(graph.distance[i]) || node.state.isWon) return;
        for (const edge of node.edges) {
            if (nodeGroup[edge.to] !== nodeGroup[i] || !Number.isFinite(graph.distance[edge.to]) || graph.nodes[edge.to].state.isWon) continue;
            quiet[i].push(edge.to); reverse[edge.to].push(i);
        }
    });
    // 只经过相同鬼位不代表已经安置；玩家必须处于可来回活动的强连通区域。
    const visited = new Uint8Array(graph.nodes.length), post = [];
    for (let start = 0; start < graph.nodes.length; start++) {
        if (expired()) return unknown('time_budget');
        if (!Number.isFinite(graph.distance[start]) || visited[start]) continue;
        visited[start] = 1;
        const stack = [{ i: start, edge: 0 }];
        while (stack.length) {
            const top = stack.at(-1);
            if (top.edge < quiet[top.i].length) {
                const to = quiet[top.i][top.edge++];
                if (!visited[to]) { visited[to] = 1; stack.push({ i: to, edge: 0 }); }
            } else { post.push(top.i); stack.pop(); }
        }
    }
    const assigned = new Uint8Array(graph.nodes.length), components = [];
    for (let k = post.length - 1; k >= 0; k--) {
        const start = post[k];
        if (assigned[start]) continue;
        assigned[start] = 1;
        const nodes = [start];
        for (let h = 0; h < nodes.length; h++) for (const to of reverse[nodes[h]]) {
            if (!assigned[to]) { assigned[to] = 1; nodes.push(to); }
        }
        components.push(nodes);
    }
    const goals = [], merged = new Map(), nodeGoal = new Int32Array(graph.nodes.length).fill(-1);
    for (const nodes of components) {
        const group = groups[nodeGroup[nodes[0]]];
        const playerRegion = [...new Set(nodes.map(i => cellKey(graph.nodes[i].state.player)))].sort();
        if (group.id === nodeGroup[0] || group.overlap || playerRegion.length < 2) continue;
        // 不按鬼的数组顺序拆成不同目标，合并相同可见安排及玩家区域。
        const key = group.id + '|' + playerRegion.join(';');
        let goal = merged.get(key);
        if (!goal) {
            goal = { id: goals.length, data: group.data, playerRegion, nodes: [] };
            merged.set(key, goal); goals.push(goal);
        }
        goal.nodes.push(...nodes);
        for (const i of nodes) nodeGoal[i] = goal.id;
    }
    if (goals.length > budget.candidateBudget) return unknown('candidate_budget');

    function without(id) {
        const queue = [0], seen = new Uint8Array(graph.nodes.length), depth = new Uint32Array(graph.nodes.length);
        const seenGoals = new Uint8Array(goals.length); seen[0] = 1;
        for (let h = 0; h < queue.length; h++) {
            if (h % 256 === 0 && expired()) return { status: 'unknown' };
            const i = queue[h];
            if (graph.nodes[i].state.isWon) return { status: 'solved', N: depth[i], states: queue.length };
            for (const edge of graph.nodes[i].edges) {
                if (nodeGoal[edge.to] === id || seen[edge.to] || !Number.isFinite(graph.distance[edge.to])) continue;
                seen[edge.to] = 1; depth[edge.to] = depth[i] + 1; queue.push(edge.to);
                if (nodeGoal[edge.to] >= 0) seenGoals[nodeGoal[edge.to]] = 1;
            }
        }
        return { status: 'proven_unsat', states: queue.length, seenGoals };
    }
    const tested = [];
    for (const goal of goals) {
        if (expired()) return unknown('time_budget');
        const { seenGoals, ...result } = without(goal.id);
        if (result.status === 'unknown') return unknown('time_budget');
        tested.push({ ...goal, result, seenGoals,
            necessity: result.status === 'proven_unsat' ? 'all_winning' : result.N > graph.distance[0] ? 'optimal_only' : 'avoidable' });
    }
    const necessary = tested.filter(goal => goal.necessity === 'all_winning'), relations = [];
    for (const a of necessary) for (const b of necessary) {
        if (a.id !== b.id && !a.seenGoals[b.id]) relations.push([a.id, b.id]);
    }
    const order = new Set(relations.map(([a, b]) => a + ':' + b)), reduced = [];
    for (const [a, b] of relations) {
        if (expired()) return unknown('time_budget');
        if (order.has(b + ':' + a)) throw new Error('必要安排的首次出现顺序成环');
        if (!necessary.some(c => c.id !== a && c.id !== b && order.has(a + ':' + c.id) && order.has(c.id + ':' + b))) reduced.push([a, b]);
    }
    return { ...base, status: 'exhausted', reason: 'complete', N: graph.distance[0], physicalStates: graph.nodes.length,
        groups: groups.length, quietComponents: components.length, candidateGroups: goals.length,
        allWinning: necessary.length, optimalOnly: tested.filter(goal => goal.necessity === 'optimal_only').length,
        goals: tested.map(({ id, data, playerRegion, necessity, result }) => ({ id, data, playerRegion, necessity, result })),
        relations, reduced };
}

/** 目标绑定原图；不允许直接套到删门等另一张地图上，避免循环证明保留条件。 */
export function createArrangementPredicate(env, report, goalId) {
    if (report.status !== 'exhausted' || report.mapId !== env.mapId || report.ruleset !== env.ruleset) {
        throw new TypeError('安排目标与完整原图分析不匹配');
    }
    const goal = report.goals.find(candidate => candidate.id === goalId);
    if (!goal) throw new TypeError('未知安排目标');
    const region = new Set(goal.playerRegion), label = JSON.stringify(goal.data);
    const doors = goal.data.doors.map(({ layer, axis, x, y }) => ({ layer, axis, x, y }));
    return state => region.has(cellKey(state.player)) && JSON.stringify(stateLabel(state, doors)) === label;
}
