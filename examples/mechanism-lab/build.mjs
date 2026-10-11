import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { smallMap } from '../../src/design/grid.js';
import { WALL_TYPES as W, DataSerializer } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { analyzeMap } from '../../src/design/analyze.js';
import { applyEdit } from '../../src/design/edits.js';

export function complementaryMap() {
    const map = smallMap([[3, 4], [3, 3], [2, 3], [1, 3], [1, 2], [4, 3], [5, 3], [5, 2]], [3, 4], [5, 2]);
    map.buttons = [{ x: 3, y: 4, letter: 'A', direction: { dx: -1, dy: 0 } }];
    map.items = [{ x: 1, y: 2, type: 'key' }];
    map.vWalls[3][3] = { type: W.LETTER_DOOR, letter: 'A', initialState: 'closed' };
    map.vWalls[3][4] = { type: W.LETTER_DOOR, letter: 'A', initialState: 'open' };
    map.hWalls[3][5] = { type: W.LOCKED, keys: 1 };
    return map;
}

export const hypotheses = [
    { id: 'press_A', sequence: [{ type: 'press', letter: 'A' }] },
    { id: 'press_A_twice', sequence: [{ type: 'press', letter: 'A' }, { type: 'press', letter: 'A' }] },
    { id: 'key_then_press_A', sequence: [{ type: 'pickup_key' }, { type: 'press', letter: 'A' }] }
];

export function buildExamples() {
    const map = complementaryMap(), edit = { type: 'wall', axis: 'h', x: 5, y: 3, wall: { type: W.EMPTY, keys: 0 } };
    const variants = [
        { id: 'complementary-switch', map, parentId: null, edit: null },
        { id: 'bypass-control', map: applyEdit(map, edit), parentId: 'complementary-switch', edit }
    ];
    const budget = { nodeBudget: 10000, stateBudget: 10000, budgetMs: 5000 };
    const records = variants.map(({ map: data, ...metadata }) => {
        const analysis = analyzeMap(data, hypotheses, budget);
        if (analysis.baseline.status !== 'solved') throw new Error('示例未获得通关证书');
        const encoded = DataSerializer.generateShareCode(data);
        if (!encoded.success) throw new Error(encoded.error);
        const decoded = DataSerializer.loadFromShareCode(encoded.code);
        if (!decoded.success) throw new Error(decoded.error);
        const { mapData, gameMode, initialHealth } = decoded.data;
        const replay = createReferenceEnvironment({ ...mapData, gameMode, initialHealth }).replay(analysis.baseline.solution.actions);
        if (!replay.state.isWon) throw new Error('分享码解码后的地图未胜利');
        return { ...metadata, familyId: 'complementary-switch-v1', source: 'hand_designed_controlled_example',
            mapId: analysis.mapId, ruleset: analysis.ruleset, analysis, sharecode: encoded.code, humanPreference: null };
    });
    const directory = new URL('./', import.meta.url);
    mkdirSync(directory, { recursive: true });
    for (const variant of variants) writeFileSync(new URL(`${variant.id}.json`, directory), JSON.stringify(variant.map, null, 2) + '\n');
    writeFileSync(new URL('hypotheses.json', directory), JSON.stringify(hypotheses, null, 2) + '\n');
    writeFileSync(new URL('evidence.json', directory), JSON.stringify(records, null, 2) + '\n');
    return records;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(buildExamples().map(r => ({ id: r.id, solution: r.analysis.baseline.solution, counterfactuals: r.analysis.counterfactuals.map(c => [c.hypothesis.id, c.conclusion]) })), null, 2));
