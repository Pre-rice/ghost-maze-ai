import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { DataSerializer } from '../../src/reference/engine.js';
import { minimizeDesign } from '../../src/design/minimize.js';

test('功能玻璃教学候选已删除，历史证书仍可追溯', () => {
    for (const id of ['01', '02']) {
        assert(!existsSync(new URL(`../../examples/minimal-units-20261007/unit-${id}.json`, import.meta.url)));
        assert(existsSync(new URL(`../../examples/minimal-units-20261007/unit-${id}-evidence.json`, import.meta.url)));
    }
});

test('保留的运行种子在参考、快环境及分享码中逐步一致', () => {
    for (const id of ['01', '02']) {
        const map = JSON.parse(readFileSync(new URL(`../../examples/puzzle-units/unit-${id}.json`, import.meta.url)));
        const result = solveFastMap(map); assert.equal(result.status, 'solved');
        const encoded = DataSerializer.generateShareCode(map); assert(encoded.success);
        const decoded = DataSerializer.loadFromShareCode(encoded.code); assert(decoded.success);
        const original = createReferenceEnvironment(map), fast = createFastEnvironment(map), restored = createReferenceEnvironment(decoded.data.mapData);
        let a = original.initialState(), b = fast.initialState(), c = restored.initialState();
        for (const action of result.solution.actions) {
            a = original.step(a, action); b = fast.step(b, action); c = restored.step(c, action);
            assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
            assert(!a.isDead);
        }
        assert(a.isWon);
    }
});

test('条件精简的预算未知仍保留在审计，不用改历史证书来假装通过', () => {
    const map = JSON.parse(readFileSync(new URL('../../examples/puzzle-units/unit-01.json', import.meta.url)));
    let calls = 0;
    const result = minimizeDesign(map, candidate => calls++ === 0
        ? { accepted: true, baseline: solveFastMap(candidate) } : { accepted: false, reason: 'unknown' });
    assert(result.localMinimality.unresolved > 0); assert.equal(result.lineage.length, 0);
    assert.deepEqual(result.map, map);
});
