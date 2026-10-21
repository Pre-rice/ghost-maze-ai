import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { GameLogic, actionFromName } from '../../src/reference/engine.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';

const budget = { nodeBudget: 900000, stateBudget: 900000, budgetMs: 24000 };
const moved = (s, n, i) => s.layerStates[0].ghosts[i].x !== n.layerStates[0].ghosts[i].x || s.layerStates[0].ghosts[i].y !== n.layerStates[0].ghosts[i].y;
const pressed = (s, n) => s.player.x === n.player.x && s.player.y === n.player.y;

/** 全部通关的普通替代查询，不是质量评分或真人试玩。 */
export function analyzeMap(map) {
    const env = createReferenceEnvironment(map), noEndMap = structuredClone(map);
    noEndMap.layers[0].endPos = null;
    const noEnd = createReferenceEnvironment(noEndMap), queries = [];
    const run = (name, initial, advance) => {
        const q = createBreadthFirstSearch(env, { monitor: {
            initial,
            advance: (h, s, a, n) => n.isWon && noEnd.step(s, a).isDead ? null : advance(h, s, a, n)
        } });
        queries.push({ name, result: q.run(budget), actions: q.firstActions() });
    };
    for (let i = 0; i < 2; i++) {
        run(`never-move-${i}`, () => [], (h, s, a, n) => moved(s, n, i) ? null : h);
        run(`finish-first-${i}`, () => [false], (h, s, a, n) => h[0] && moved(s, n, i) ? null : [h[0] || moved(s, n, 1 - i)]);
        run(`finish-last-${i}`, () => [false], (h, s, a, n) => h[0] && moved(s, n, 1 - i) ? null : [h[0] || moved(s, n, i)]);
    }
    for (const y of [0, 1]) {
        run(`never-controller-${y}`, () => [], (h, s, a, n) => pressed(s, n) && s.player.y === y ? null : h);
        run(`first-controller-${y}`, () => [false], (h, s, a, n) => {
            if (!h[0] && pressed(s, n) && s.player.y !== y) return null;
            return [h[0] || pressed(s, n)];
        });
    }
    run('only-initial-configuration', () => [false], (h, s, a, n) => h[0] && pressed(s, n) ? null : [h[0] || [0, 1].some(i => moved(s, n, i))]);
    run('never-functional-priority', () => [], (h, s, a, n) => {
        const diagnostics = [];
        GameLogic.calculateNextState(s, actionFromName(a), env.mapDefinition, { trails: false, visibility: false, ghostDiagnostics: diagnostics });
        const used = diagnostics.some(d => d.decision === 'visible_target_priority' && d.contenders.some(c => {
            if (!c.seesAfter) return false;
            const winner = s.layerStates[0].ghosts.findIndex(g => g.x === c.from.x && g.y === c.from.y);
            if (winner < 0) return false;
            const g = n.layerStates[0].ghosts[winner];
            return g.x === d.target.x && g.y === d.target.y;
        }));
        return used ? null : h;
    });
    // 虚拟查询目标只表示取到钥匙；实际动作再交给原生无终点环境重放。
    const keyGoal = { ...noEnd, step: (s, a) => {
        const n = noEnd.step(s, a);
        if (n !== s && !n.isDead && n.player.keys > 0) {
            const marked = n.clone();
            marked.isWon = true;
            return marked;
        }
        return n;
    } };
    const keyQuery = createBreadthFirstSearch(keyGoal, { monitor: {
        initial: () => [false],
        advance: (h, s, a, n) => {
            if (!h[0] && pressed(s, n) && s.player.y !== 1) return null;
            const next = [h[0] || pressed(s, n)];
            return n.isWon && !next[0] ? null : next;
        }
    } });
    const result = keyQuery.run(budget), actions = keyQuery.firstActions();
    let actualState = null;
    if (actions) {
        const s = noEnd.replay(actions).state;
        actualState = { p: [s.player.x, s.player.y], g: s.layerStates[0].ghosts.map(g => [g.x, g.y]), keys: s.player.keys, won: s.isWon, dead: s.isDead };
    }
    return {
        scope: '全部无伤无复活通关，允许非最优重合；终点当步去判胜，角色历史进入完整键，交接当步允许共同移动；必要性不作趣味分。',
        queries,
        wrongFirstCanReachKey: { firstControllerY: 1, result, actions, actualState, scope: '仅取钥匙的虚拟目标，不称为通关或真人尝试' }
    };
}
