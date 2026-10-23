import { WALL_TYPES as W, GameLogic, actionFromName } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { analyzeOrdinaryPlans } from '../../src/design/ordinary-plans.js';

const budget = { nodeBudget: 800000, stateBudget: 800000, budgetMs: 15000 };
const overlaps = state => new Set(state.layerStates[0].ghosts.map(g => `${g.x},${g.y}`)).size !== 2;

export function analyzeMap(map) {
    const env = createReferenceEnvironment(map), noEndMap = structuredClone(map);
    noEndMap.layers[0].endPos = null;
    const noEnd = createReferenceEnvironment(noEndMap), checks = [];
    for (const avoidOverlap of [false, true]) for (const name of ['keep-upper-up', 'keep-lower-down',
        'never-lower-up-before-key', 'never-upper-down-before-key', 'never-priority-conflict']) {
        const search = createBreadthFirstSearch(env, { monitor: {
            initial: () => [],
            advance: (history, before, action, after) => {
                if (after.isWon && noEnd.step(before, action).isDead || avoidOverlap && overlaps(after)) return null;
                const ghosts = after.layerStates[0].ghosts;
                if (name === 'keep-upper-up' && ghosts[0].y >= 3 ||
                    name === 'keep-lower-down' && ghosts[1].y < 3 ||
                    name === 'never-lower-up-before-key' && before.player.keys === 0 && ghosts[1].y < 3 ||
                    name === 'never-upper-down-before-key' && before.player.keys === 0 && ghosts[0].y >= 3) return null;
                if (name === 'never-priority-conflict') {
                    const diagnostics = [];
                    GameLogic.calculateNextState(before, actionFromName(action), env.mapDefinition,
                        { trails: false, visibility: false, ghostDiagnostics: diagnostics });
                    if (diagnostics.some(d => d.decision === 'visible_target_priority')) return null;
                }
                return history;
            }
        } });
        checks.push({ name, avoidOverlap, result: search.run(budget), actions: search.firstActions() });
    }
    const variants = ['ordinary', 'empty', 'solid', 'reverse'].map(mode => {
        const changed = structuredClone(map);
        changed.layers[0].hWalls[3][1] = mode === 'reverse' ?
            { type: W.ONE_WAY, keys: 0, direction: { dx: 0, dy: -1 } } :
            { type: mode === 'ordinary' ? W.DOOR : mode === 'empty' ? W.EMPTY : W.SOLID, keys: 0 };
        const e = createReferenceEnvironment(changed), search = createBreadthFirstSearch(e, { allOptimal: true });
        const result = search.run(budget), actions = search.firstActions(), n = structuredClone(changed);
        n.layers[0].endPos = null;
        let noEndReference = false, trace = [], state = e.initialState();
        if (actions) {
            try { createReferenceEnvironment(n).replay(actions); noEndReference = true; } catch {}
            trace = actions.map(action => {
                state = e.step(state, action);
                return { action, p: [state.player.x, state.player.y], g: state.layerStates[0].ghosts.map(g => [g.x, g.y]) };
            });
        }
        return { mode, result, actions, raw: search.routeCount().toString(), noEndReference, trace };
    });
    const prefix = ['R', 'D', 'R', 'R', 'R', 'D', 'D'];
    const initial = env.replay(prefix).state;
    const wrongPlans = [false, true].map(avoidOverlap => {
        const search = createBreadthFirstSearch({ ...env, initialState: () => initial }, { monitor: {
            initial: () => [],
            advance: (history, before, action, after) => after.isWon && noEnd.step(before, action).isDead ||
                avoidOverlap && overlaps(after) ? null : history
        } });
        return { name: 'first-take-key', prefix, avoidOverlap,
            state: { p: [initial.player.x, initial.player.y],
                g: initial.layerStates[0].ghosts.map(g => [g.x, g.y]), keys: initial.player.keys },
            result: search.run(budget), actions: search.firstActions() };
    });
    return { checks, variants, wrongPlans,
        ordinary: analyzeOrdinaryPlans(map, { ...budget, totalBudgetMs: 60000, orderBudget: 2 }),
        humanQuality: null,
        scope: '完整无伤通关指定事件查询；允许／禁止非最优重合分别记录，不以禁止重合的无解冒充全部合法无解。改门另作反事实。' };
}
