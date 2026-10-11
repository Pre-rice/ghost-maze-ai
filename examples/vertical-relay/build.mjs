import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { smallMap } from '../../src/design/grid.js';
import { WALL_TYPES as W, DataSerializer } from '../../src/reference/engine.js';
import { analyzeMap } from '../../src/design/analyze.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { physicalState } from '../../src/search/fast-environment.js';
import assert from 'node:assert/strict';

export function verticalRelayMap(control = false) {
    const lower = smallMap([[1, 4], [2, 4], [3, 4], [4, 4]], [1, 4], [4, 4]);
    const upper = smallMap([[2, 4], [2, 3], [3, 4], [4, 4]], [2, 4], null);
    lower.vWalls[4][3] = control ? { type: W.DOOR, keys: 0 } : { type: W.LETTER_DOOR, letter: 'A', initialState: 'closed' };
    lower.vWalls[4][4] = { type: W.LOCKED, keys: 1 };
    upper.items = [{ x: 4, y: 4, type: 'key' }];
    upper.buttons = [{ x: 2, y: 3, direction: { dx: -1, dy: 0 }, letter: 'A' }];
    return { ...lower, multiLayerMode: true, layerCount: 2,
        layers: [lower, upper].map((m, layer) => ({
            hWalls: m.hWalls, vWalls: m.vWalls, activeCells: m.activeCells, ghosts: [], items: m.items,
            buttons: m.buttons, endPos: m.endPos, customStartPos: layer === 0 ? m.customStartPos : null
        })),
        stairs: [{ x: 2, y: 4, layer: 0, direction: 'up' }, { x: 2, y: 4, layer: 1, direction: 'down' }]
    };
}

export const hypotheses = [
    { id: 'press_A', sequence: [{ type: 'press', letter: 'A' }] },
    { id: 'pickup_key', sequence: [{ type: 'pickup_key' }] },
    { id: 'upper_then_lower', sequence: [{ type: 'visit', layer: 1, x: 2, y: 4 }, { type: 'visit', layer: 0, x: 2, y: 4 }] }
];

export function buildVerticalExamples() {
    const records = [false, true].map(control => {
        const map = verticalRelayMap(control), id = control ? 'local-key-control' : 'remote-switch';
        const analysis = analyzeMap(map, hypotheses, { nodeBudget: 30000, stateBudget: 30000, budgetMs: 10000 });
        assert.equal(analysis.baseline.status, 'solved');
        const encoded = DataSerializer.generateShareCode(map);
        assert(encoded.success);
        const decoded = DataSerializer.loadFromShareCode(encoded.code);
        assert(decoded.success);
        const { mapData, gameMode, initialHealth } = decoded.data;
        const original = createReferenceEnvironment(map).replay(analysis.baseline.solution.actions);
        const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth }).replay(analysis.baseline.solution.actions);
        assert.deepEqual(physicalState(restored.state), physicalState(original.state));
        writeFileSync(new URL(`${id}.json`, import.meta.url), JSON.stringify(map, null, 2) + '\n');
        return { id, familyId: 'vertical-relay-v1', source: 'hand_designed_controlled_example',
            parentId: control ? 'remote-switch' : null,
            edit: control ? { layer: 0, axis: 'v', x: 3, y: 4, wall: { type: W.DOOR, keys: 0 } } : null,
            ruleset: analysis.ruleset, mapId: analysis.mapId, analysis, sharecode: encoded.code, humanPreference: null };
    });
    writeFileSync(new URL('evidence.json', import.meta.url), JSON.stringify(records, null, 2) + '\n');
    return records;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(buildVerticalExamples().map(r => ({ id: r.id, solution: r.analysis.baseline.solution, counterfactuals: r.analysis.counterfactuals.map(c => [c.hypothesis.id, c.conclusion]) })), null, 2));
