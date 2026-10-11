import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { smallMap } from '../../src/design/grid.js';
import { WALL_TYPES as W, DataSerializer } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { physicalState } from '../../src/search/fast-environment.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { analyzeMap } from '../../src/design/analyze.js';
import { solveFastMap } from '../../src/search/fast-solver.js';

// 搜索候选 12579 经删去无关鬼、死区并增设起点观察窗后定稿；18 格，一只鬼。
export function coupledMap() {
    const cells = [
        [1, 1], [2, 1], [3, 1], [4, 1],
        [1, 2], [2, 2], [3, 2], [4, 2], [5, 2],
        [2, 3], [4, 3],
        [1, 4], [2, 4], [4, 4],
        [1, 5], [2, 5], [3, 5], [4, 5]
    ];
    const map = smallMap(cells, [3, 2], [5, 2]);
    map.initialGhosts = [{ x: 4, y: 2, id: 0 }];
    map.buttons = [
        { x: 1, y: 4, letter: 'A', direction: { dx: 0, dy: -1 } },
        { x: 4, y: 1, letter: 'B', direction: { dx: 0, dy: -1 } }
    ];
    map.hWalls[2][3] = { type: W.SOLID, keys: 0 };
    map.hWalls[5][2] = { type: W.SOLID, keys: 0 };
    map.vWalls[2][3] = { type: W.DOOR, keys: 0 };
    map.vWalls[2][4] = { type: W.GLASS, keys: 0 };
    map.hWalls[2][4] = { type: W.LETTER_DOOR, letter: 'A', initialState: 'closed' };
    map.vWalls[5][3] = { type: W.LETTER_DOOR, letter: 'A', initialState: 'closed' };
    map.hWalls[2][1] = { type: W.LETTER_DOOR, letter: 'B', initialState: 'open' };
    map.hWalls[5][4] = { type: W.LETTER_DOOR, letter: 'B', initialState: 'closed' };
    return map;
}

const visit = (x, y) => ({ type: 'visit', layer: 0, x, y });
const ghost = (x, y) => ({ type: 'ghost_at', layer: 0, x, y });
export const hypotheses = [
    { id: 'B_then_A_then_B', sequence: ['B', 'A', 'B'].map(letter => ({ type: 'press', letter })) },
    { id: 'lower_lure_position', sequence: [visit(4, 5)] },
    { id: 'ghost_displaced_down', sequence: [ghost(4, 4)] },
    { id: 'ghost_displaced_left', sequence: [ghost(2, 1)] }
];
export const failedPlans = [
    { id: 'open_A_then_approach_exit', actions: [...'LDDLURUUURR'] },
    { id: 'prepare_gates_but_skip_lure', actions: [...'LURRULLDDDLURUUURR'] },
    { id: 'lure_once_then_enter_exit_corridor', actions: [...'LURRULLDDDLUDRRRLLLURUUURRD'] }
];

function trace(env, actions) {
    let state = env.initialState();
    const row = (action, index) => ({ index, action, ...physicalState(state) });
    const rows = [row(null, 0)];
    for (const [index, action] of actions.entries()) {
        assert(!state.isDead && !state.isWon, '轨迹在终止后仍有动作');
        const next = env.step(state, action);
        assert.notEqual(next, state, '轨迹包含无效动作');
        state = next; rows.push(row(action, index + 1));
    }
    return { state, rows };
}

const compactTrace = rows => rows.map(row => ({
    index: row.index, action: row.action, player: row.player,
    ghosts: row.layers[0].ghosts, isDead: row.isDead, isWon: row.isWon,
    gates: ['h', 'v'].flatMap(axis => row.layers[0].wallStates[axis].flatMap((walls, y) =>
        walls.flatMap((wall, x) => wall.type === W.LETTER_DOOR ? [{ axis, x, y, letter: wall.letter, state: wall.currentState }] : [])))
}));

export function buildCoupled() {
    const map = coupledMap(), env = createReferenceEnvironment(map);
    const budget = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 30000 };
    const analysis = analyzeMap(map, hypotheses, budget);
    assert.equal(analysis.baseline.status, 'solved');
    assert.equal(analysis.baseline.optimality, 'proven');
    const reference = solveReferenceMap(map, budget);
    assert.equal(reference.solution.totalActions, analysis.baseline.solution.totalActions);
    const restrictionsReference = hypotheses.map(hypothesis => solveReferenceMap(map, { ...budget, restrictions: [hypothesis] }));
    assert(analysis.counterfactuals.every(r => r.conclusion === 'necessary_within_scope'));
    assert(restrictionsReference.every(r => r.status === 'proven_unsat'));
    const solutionTrace = trace(env, analysis.baseline.solution.actions);
    const failures = failedPlans.map(plan => {
        const attempt = trace(env, plan.actions);
        assert(attempt.state.isDead, `${plan.id} 未按预期失败`);
        return { ...plan, trace: compactTrace(attempt.rows) };
    });
    const encoded = DataSerializer.generateShareCode(map);
    assert(encoded.success);
    const decoded = DataSerializer.loadFromShareCode(encoded.code);
    assert(decoded.success);
    const { mapData, gameMode, initialHealth } = decoded.data;
    const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth });
    assert.deepEqual(trace(restored, analysis.baseline.solution.actions).rows, solutionTrace.rows);
    const noGoal = { ...map, endPos: null };
    const exit = createReferenceEnvironment(noGoal).replay(analysis.baseline.solution.actions);
    assert(!exit.state.isDead);
    const seen = env.initialState().seenCells[0];
    assert(seen[2][4] && seen[2][5], '起点需要看得到守门鬼与目标');
    // 不以某条最短解的路线冒称所有解都必须走；保留一个绕路替代证书。
    const alternative = solveFastMap(map, { ...budget, restrictions: [{ id: 'avoid_upper_left_corner', sequence: [visit(1, 1)] }] });
    const record = {
        schemaVersion: 1, id: 'singlelayer-01', familyId: 'dual-loop-relay-v1', ruleset: env.ruleset, mapId: env.mapId,
        source: 'search_proposal_with_manual_refinement',
        provenance: { discoveryScript: 'discover.mjs', randomSeed: 930261, proposalIndex: 12579,
            edits: ['去掉无关的第二只鬼', '删除未参与机关关系的七个格子', '起点右侧改玻璃，左侧改普通门，提供安全观察'] },
        humanPreference: null, targetQuality: 'awaiting_user_review', analysis, reference, restrictionsReference,
        trace: compactTrace(solutionTrace.rows), failedPlans: failures,
        contrastWithoutGhost: solveFastMap(map, { ...budget, withGhosts: false }),
        alternative, exitWithoutGoal: physicalState(exit.state), sharecode: encoded.code,
        fairnessChecks: { startSeesGhost: seen[2][4], startSeesGoal: seen[2][5], fullInformationFairnessProven: false }
    };
    const directory = new URL('./', import.meta.url);
    mkdirSync(directory, { recursive: true });
    writeFileSync(new URL('map.json', directory), JSON.stringify(map, null, 2) + '\n');
    writeFileSync(new URL('evidence.json', directory), JSON.stringify(record, null, 2) + '\n');
    return record;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const r = buildCoupled();
    console.log(JSON.stringify({ id: r.id, mapId: r.mapId, actions: r.analysis.baseline.solution.totalActions, sharecode: r.sharecode }, null, 2));
}
