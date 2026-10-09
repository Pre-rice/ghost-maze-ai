import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { compileRestrictions } from '../../src/search/restrictions.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { DataSerializer } from '../../src/reference/engine.js';
import { minimizeDesign } from '../../src/design/minimize.js';
import { createUnitEvaluator } from '../../examples/minimal-units-20261007/build.mjs';

const directory = new URL('../../examples/minimal-units-20261007/', import.meta.url);
const read = file => JSON.parse(readFileSync(new URL(file, directory), 'utf8'));

test('新单元分享码逐步重放与原图一致；移除终点仍可安全完成', () => {
    for (const id of ['01', '02']) {
        const map = read(`unit-${id}.json`), evidence = read(`unit-${id}-evidence.json`);
        const decoded = DataSerializer.loadFromShareCode(evidence.sharecode); assert(decoded.success);
        const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
        const env = createReferenceEnvironment(map), restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth, initialStamina });
        let a = env.initialState(), b = restored.initialState();
        for (const action of evidence.solution.solution.actions) {
            a = env.step(a, action); b = restored.step(b, action);
            assert.deepEqual(physicalState(a), physicalState(b)); assert(!a.isDead);
        }
        assert(a.isWon); assert.equal(env.mapId, evidence.mapId);
        const exit = createReferenceEnvironment({ ...map, endPos: null }).replay(evidence.solution.solution.actions);
        assert.deepEqual(physicalState(exit.state), evidence.exitWithoutGoal);
        assert.equal(evidence.humanQuality, null);
    }
});

test('两个单元在声明的逐项精简范围内均已收敛，原图不会被修改', () => {
    for (const id of ['01', '02']) {
        const map = read(`unit-${id}.json`), original = structuredClone(map), evidence = read(`unit-${id}-evidence.json`);
        const result = minimizeDesign(map, createUnitEvaluator(evidence.kind));
        assert.deepEqual(map, original);
        assert.equal(result.lineage.length, 0);
        assert.equal(result.localMinimality.unresolved, 0);
        assert.equal(result.localMinimality.globalMinimumProven, false);
        assert.equal(result.complexity[0], 10);
    }
});

test('原引擎和快环境对每个挡鬼事件逐步一致，影子诊断不污染原快照', () => {
    const map = read('unit-02.json'), evidence = read('unit-02-evidence.json');
    const original = createReferenceEnvironment(map), fast = createFastEnvironment(map);
    const restrictions = [0, 1].map(index => ({ id: `b${index}`, sequence: [{ type: 'ghost_blocked', index }] }));
    const monitor = compileRestrictions(original.mapDefinition, restrictions);
    let a = original.initialState(), b = fast.initialState(), blocks = [];
    for (const [i, action] of evidence.solution.solution.actions.entries()) {
        const keyA = original.stateKey(a), keyB = fast.stateKey(b);
        const nextA = original.step(a, action), nextB = fast.step(b, action);
        const eventA = monitor.advance([0, 0], a, action, nextA);
        const eventB = monitor.advance([0, 0], b, action, nextB);
        assert.deepEqual(eventA, eventB);
        assert.equal(original.stateKey(a), keyA); assert.equal(fast.stateKey(b), keyB);
        if (eventA === null) blocks.push(i + 1);
        a = nextA; b = nextB;
    }
    assert.deepEqual(blocks, [13]);
    assert.throws(() => compileRestrictions(original.mapDefinition, [{ id: 'bad', sequence: [{ type: 'ghost_blocked', index: 2 }] }]), TypeError);
});

test('两鬼单元不依赖隐藏的数组先后：反序同成本，原动作仍可通关且干涉不可避', () => {
    const map = read('unit-02.json'), evidence = read('unit-02-evidence.json'); map.initialGhosts.reverse();
    const result = solveFastMap(map); assert.equal(result.solution.totalActions, 14);
    assert(createReferenceEnvironment(map).replay(evidence.solution.solution.actions).state.isWon);
    const restrictions = [0, 1].map(index => ({ id: `b${index}`, sequence: [{ type: 'ghost_blocked', index }] }));
    assert.equal(solveFastMap(map, { restrictions }).status, 'proven_unsat');
});

test('精简中的未知必须留在审计，不冒称已证明最简', () => {
    const map = read('unit-01.json'); let calls = 0;
    const result = minimizeDesign(map, candidate => {
        if (calls++ === 0) return { accepted: true, baseline: solveFastMap(candidate) };
        return { accepted: false, reason: 'unknown' };
    });
    assert(result.localMinimality.unresolved > 0);
    assert.equal(result.lineage.length, 0);
    assert.deepEqual(result.map, map);
});
