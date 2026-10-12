import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GameLogic, MapDefinition, WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment, actionFromName } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { makeSimulator, createInitState, step, stateKey, wallBits } from '../../src/validate/simulator.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { solveMap } from '../../src/validate/solver.js';
import { verifyStructuralSolvability, isStructurallySolvable } from '../../src/validate/solvabilityVerifier.js';
import { relaxedDistField } from '../../src/search/relaxed-distance.js';
import { seedMap, smallMap, keyDetourMap, stairMap } from './fixtures.mjs';

const BUDGET = { nodeBudget: 30000, stateBudget: 30000, budgetMs: 60000 };
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

function randomMicroMap(seed) {
    const random = rng(seed), cells = [];
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) cells.push([x, y]);
    const map = smallMap(cells, [1, 1], [3, 3], 8);
    const choices = [W.EMPTY, W.EMPTY, W.SOLID, W.DOOR, W.GLASS, W.ONE_WAY];
    for (const [x, y] of cells) for (const horizontal of [false, true]) {
        if (horizontal ? y === 3 : x === 3) continue;
        const type = choices[Math.floor(random() * choices.length)];
        const wall = { type, keys: 0 };
        if (type === W.ONE_WAY) wall.direction = horizontal ? { dx: 0, dy: random() < 0.5 ? 1 : -1 } : { dx: random() < 0.5 ? 1 : -1, dy: 0 };
        if (horizontal) map.hWalls[y + 1][x] = wall; else map.vWalls[y][x + 1] = wall;
    }
    map.items = [{ x: 1, y: 2, type: 'key' }];
    if (seed % 2 === 0) map.vWalls[3][3] = { type: W.LOCKED, keys: 1 };
    if (seed % 3 === 0) {
        map.buttons = [{ x: 1, y: 1, direction: { dx: 0, dy: -1 }, letter: 'A' }];
        map.hWalls[2][2] = { type: W.LETTER_DOOR, letter: 'A', initialState: seed % 2 === 0 ? 'open' : 'closed' };
    }
    if (seed % 4 !== 0) map.initialGhosts = [{ x: 3, y: 1, id: 0 }];
    return map;
}

function duel(map, seed, count) {
    const def = new MapDefinition(map), sim = makeSimulator(map), random = rng(seed);
    let original = GameLogic.createInitialState(def), compact = createInitState(sim);
    for (let i = 0; i < count; i++) {
        const names = ['U', 'R', 'D', 'L', 'STAIR'];
        const action = original.isDead || original.isWon ? { type: 'REVIVE' } : actionFromName(names[Math.floor(random() * names.length)]);
        const before = JSON.stringify(physicalState(compact));
        const nextOriginal = GameLogic.calculateNextState(original, action, def), nextCompact = step(compact, action, sim);
        assert.equal(nextOriginal === original, nextCompact === compact, `seed=${seed} 动作 ${i} 无效动作语义`);
        assert.equal(JSON.stringify(physicalState(compact)), before, `seed=${seed} 动作 ${i} 污染前态`);
        assert.deepEqual(physicalState(nextCompact), physicalState(nextOriginal), `seed=${seed} 动作 ${i} ${action.type}`);
        original = nextOriginal; compact = nextCompact;
        if (original.isDead || original.isWon) {
            const revived = { type: 'REVIVE' };
            original = GameLogic.calculateNextState(original, revived, def);
            compact = step(compact, revived, sim);
            assert.deepEqual(physicalState(compact), physicalState(original));
            if (original.isDead || original.isWon) { original = GameLogic.createInitialState(def); compact = createInitState(sim); }
        }
    }
}

test('确定性随机动作差分：24 张全机制微图、两种模式，每条 120 步', () => {
    for (let seed = 1; seed <= 24; seed++) for (const gameMode of ['death-loop', 'exploration']) duel({ ...randomMicroMap(seed), gameMode }, seed, 120);
});

test('多层动作差分：全局按钮、楼梯、鬼转层与死亡后重置', () => {
    const map = stairMap(true);
    map.layers[1].ghosts = [{ x: 2, y: 2, id: 0 }];
    for (const mode of ['death-loop', 'exploration']) duel({ ...map, gameMode: mode }, 42, 200);
    const env = createFastEnvironment(map);
    assert.throws(() => env.step(env.initialState(), 'PRESS_BUTTON'), TypeError);
    assert.throws(() => env.step(env.initialState(), 'REVIVE'), TypeError);
});

test('33 扇以上动态门的初态、翻转与开锁位互不碰撞', () => {
    const map = smallMap([[3, 6], [4, 6], [5, 6]], [3, 6], [5, 6]);
    map.activeCells = map.activeCells.map(row=>row.map(()=>true));
    for (let index = 0; index < 33; index++) map.hWalls[Math.floor(index / map.width)][index % map.width] = {
        type: W.LETTER_DOOR, letter: index === 0 ? 'A' : index === 32 ? 'B' : 'C', initialState: 'closed'
    };
    map.buttons = [
        { x: 3, y: 6, direction: { dx: 0, dy: -1 }, letter: 'A' },
        { x: 3, y: 6, direction: { dx: 0, dy: 1 }, letter: 'B' }
    ];
    const env = createFastEnvironment(map), original = env.initialState();
    const a = env.step(original, 'U'), b = env.step(original, 'D');
    assert.equal(wallBits(a, env.sim), 1n);
    assert.equal(wallBits(b, env.sim), 1n << 32n);
    assert.notEqual(env.stateKey(a), env.stateKey(b));
    assert.equal(wallBits(env.step(b, 'D'), env.sim), 0n);
    map.hWalls[4][0].initialState = 'open';
    const indexed=makeSimulator(map);assert.equal(wallBits(createInitState(indexed), indexed), 1n << 32n);
    map.vWalls[6][4] = { type: W.LOCKED, keys: 0 };
    const locks = createFastEnvironment(map), crossed = locks.step(locks.initialState(), 'R');
    assert.equal(wallBits(crossed, locks.sim) & (1n << 33n), 1n << 33n);
    assert.deepEqual(physicalState(crossed), physicalState(locks.reference.step(locks.reference.initialState(), 'R')));
});

test('写时复制不污染共享父态和兄弟分支；状态键保留顺序与资源', () => {
    const env = createFastEnvironment(seedMap('unit-02')), initial = env.initialState();
    const before = JSON.stringify(physicalState(initial));
    const closed = env.step(initial, 'L'), peeked = env.step(initial, 'U');
    assert.equal(JSON.stringify(physicalState(initial)), before);
    assert.equal(closed.layerStates[0].wallStates.v[2][3].currentState, 'closed');
    assert.equal(peeked.layerStates[0].wallStates.v[2][3].currentState, 'open');
    const clone = structuredClone(initial); clone.player.hp--;
    assert.notEqual(env.stateKey(initial), env.stateKey(clone));
    const sim = makeSimulator(seedMap('unit-01')), a = createInitState(sim);
    a.layerStates[0].ghosts = [{ x: 1, y: 2 }, { x: 2, y: 1 }];
    a.layerStates[0].items = [{ x: 1, y: 3, type: 'key' }, { x: 2, y: 4, type: 'key' }];
    const b = structuredClone(a); b.layerStates[0].ghosts.reverse();
    assert.notEqual(stateKey(a, sim), stateKey(b, sim));
    const c = structuredClone(a); c.layerStates[0].items.reverse();
    assert.notEqual(stateKey(a, sim), stateKey(c, sim));
    const d = structuredClone(a); d.isWon = true;
    assert.notEqual(stateKey(a, sim), stateKey(d, sim));
});

test('独立参考 BFS 对照：24 张微图的可解性和最短动作一致', () => {
    for (let seed = 1; seed <= 24; seed++) {
        const map = randomMicroMap(seed), reference = solveReferenceMap(map, BUDGET), fast = solveFastMap(map, BUDGET);
        assert.notEqual(reference.status, 'unknown', `基准测试预算不足：${seed}`);
        assert.equal(fast.status, reference.status, `seed=${seed}`);
        assert.equal(fast.solution?.totalActions, reference.solution?.totalActions, `seed=${seed} 最短动作`);
        if (fast.solution) {
            assert.equal(fast.optimality, 'proven');
            assert(createReferenceEnvironment(map).replay(fast.solution.actions).state.isWon);
        }
    }
});

test('种子、钥匙、按钮和楼梯的解与参考一致，取消体力限制后仍由共同规则判胜', () => {
    for (const map of [seedMap('unit-01'), seedMap('unit-02'), keyDetourMap(), stairMap(), stairMap(true)]) {
        const expected = solveReferenceMap(map, BUDGET), result = solveFastMap(map, BUDGET);
        assert.equal(result.status, 'solved');
        assert.equal(result.solution.totalActions, expected.solution.totalActions);
        map.initialStamina = result.solution.movementCost;
        assert.equal(solveFastMap(map, BUDGET).status, 'solved');
    }
    const duplicate = smallMap([[1, 2], [2, 2], [3, 2], [4, 2]], [1, 2], [4, 2], 5);
    duplicate.items = [{ x: 2, y: 2, type: 'key' }, { x: 2, y: 2, type: 'key' }];
    duplicate.vWalls[2][3] = { type: W.LOCKED, keys: 2 };
    assert.throws(()=>solveFastMap(duplicate, BUDGET), /重复实体/);
});

test('预算区分未知、已发现解但未证明最优，以及真正无解', () => {
    const map = keyDetourMap();
    for (const [options, reason] of [[{ nodeBudget: 0 }, 'node_budget'], [{ budgetMs: 0 }, 'time_budget'], [{ stateBudget: 1 }, 'state_budget']]) {
        const result = solveFastMap(map, { ...BUDGET, ...options });
        assert.equal(result.status, 'unknown'); assert.equal(result.reason, reason); assert.equal(result.solution, null);
    }
    const adjacent = smallMap([[1, 2], [2, 2]], [1, 2], [2, 2]);
    for (const options of [{ nodeBudget: 1 }, { stateBudget: 1 }]) {
        const result = solveFastMap(adjacent, { ...BUDGET, ...options });
        assert.equal(result.status, 'solved'); assert.equal(result.optimality, 'not_proven');
        assert.equal(result.solution.totalActions, 1);
    }
    const impossible = smallMap([[1, 2], [3, 2]], [1, 2], [3, 2]);
    const result = solveFastMap(impossible, BUDGET);
    assert.equal(result.status, 'proven_unsat'); assert.equal(result.reason, 'relaxed_unreachable');
    const short = smallMap([[1, 2], [2, 2], [3, 2]], [1, 2], [3, 2], 1);
    assert.equal(solveFastMap(short, BUDGET).status, 'solved');
});

test('出生点恰好是终点时共同规则立即判胜，最短为零动作', () => {
    const map = smallMap([[1, 2], [2, 2]], [1, 2], [1, 2]);
    assert.equal(solveFastMap(map, BUDGET).solution.totalActions, 0);
    assert.equal(solveReferenceMap(map, BUDGET).solution.totalActions, 0);
});

test('旧接口保留 nullable 可解性，无鬼验证明确标注松弛范围', () => {
    const unknown = solveMap(keyDetourMap(), { nodeBudget: 0, entryBudget: 100 });
    assert.equal(unknown.status, 'unknown'); assert.equal(unknown.solvable, null);
    assert.equal(isStructurallySolvable(keyDetourMap(), { nodeBudget: 0 }), null);
    const map = smallMap([[1, 2], [2, 2], [3, 2]], [1, 2], [3, 2]);
    map.initialGhosts = [{ x: 2, y: 2, id: 0 }];
    assert.equal(solveFastMap(map, BUDGET).status, 'proven_unsat');
    const relaxed = verifyStructuralSolvability(map, BUDGET);
    assert.equal(relaxed.status, 'solved'); assert.equal(relaxed.scope.withGhosts, false);
    assert.throws(() => solveMap(map, { entryBudget: 10, stateBudget: 10 }), TypeError);
    for (const options of [{ withGhosts: 'false' }, { budgetMs: Infinity }, { stateBudget: 0 }, { nodeBudget: -1 }]) assert.throws(() => solveFastMap(map, options), TypeError);
});

test('出生点规范化不再读取已淘汰的 mapStartPos 字段', () => {
    const map = smallMap([[1, 2], [2, 2], [3, 2]], [1, 2], [3, 2]);
    map.mapStartPos = { x: 2, y: 2 };
    assert.deepEqual(makeSimulator(map).startPos, new MapDefinition(map).playerStart);
});

test('快 CLI 与旧验证 CLI 都明确传递未知，不能要求用户把未知图当无解重做', () => {
    const cwd = fileURLToPath(new URL('../../', import.meta.url));
    const fast = spawnSync(process.execPath, ['src/search/solve-map.mjs', 'examples/puzzle-units/unit-02.json', '--nodes', '0'], { cwd, encoding: 'utf8' });
    assert.equal(fast.status, 3);
    assert.equal(JSON.parse(fast.stdout).status, 'unknown');
    const legacy = spawnSync(process.execPath, ['src/tools/validate-map.js', 'examples/puzzle-units/unit-02.json', '--json', '--no-stage1', '--nodes', '0'], { cwd, encoding: 'utf8' });
    assert.equal(legacy.status, 3, legacy.stderr);
    const report = JSON.parse(legacy.stdout);
    assert.equal(report.status, 'unknown');
    assert.equal(report.gates.structurallySolvable.passed, null);
    assert.equal(report.gates.zeroHitSolvable.passed, null);
});

test('多源跨层下界可经另一层回到原层，且取最近的任意终点', () => {
    const low = smallMap([[1, 2], [3, 2]], [1, 2], [3, 2]);
    const high = smallMap([[1, 2], [2, 2], [3, 2]], [1, 2], null);
    low.multiLayerMode = true; low.layerCount = 2;
    low.layers = [low, high].map((m, li) => ({ hWalls: m.hWalls, vWalls: m.vWalls, activeCells: m.activeCells, ghosts: [], items: [], buttons: [], endPos: m.endPos, customStartPos: li ? null : m.customStartPos }));
    low.stairs = [1, 3].flatMap(x => [{ x, y: 2, layer: 0, direction: 'up' }, { x, y: 2, layer: 1, direction: 'down' }]);
    assert.equal(relaxedDistField(makeSimulator(low))[0][2][1], 4);
    assert.equal(solveFastMap(low, BUDGET).solution.totalActions, 4);
    low.layers[1].endPos = { x: 1, y: 2 };
    assert.equal(solveFastMap(low, BUDGET).solution.totalActions, 1);
});
