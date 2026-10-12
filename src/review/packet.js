import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createReferenceEnvironment } from '../reference/environment.js';
import { DataSerializer, validateMapData } from '../reference/engine.js';
import { physicalState } from '../search/fast-environment.js';
import { solveFastMap } from '../search/fast-solver.js';
import { seededRandom } from '../design/edits.js';
import { assertPuzzleBoundarySafety } from '../design/rule-boundaries.js';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const defaultGroups = [
    ['lure-loop-v1', 'examples/puzzle-units/unit-01.json', 'examples/puzzle-units/unit-02.json'],
    ['complementary-switch-v1', 'examples/mechanism-lab/complementary-switch.json', 'examples/mechanism-lab/bypass-control.json'],
    ['vertical-relay-v1', 'examples/vertical-relay/remote-switch.json', 'examples/vertical-relay/local-key-control.json']
];
export function packetId(packet) {
    const { id, ...content } = packet;
    return hash(content);
}

/** 发布前重新求解并重放分享码；评审页不发送证书、来源或机制标签。 */
export function buildPacket(seed = 20260930, groups = defaultGroups) {
    const random = seededRandom(seed);
    let ruleset;
    const pairs = groups.map(([familyId, ...files], index) => {
        const candidates = files.map(file => {
            const checked = validateMapData(JSON.parse(readFileSync(new URL(file, root), 'utf8')));
            if (!checked.valid) throw new TypeError(`${file} 地图无效：${checked.error}`);
            const map = checked.mapData;
            assertPuzzleBoundarySafety(map, { nodeBudget: 30000, budgetMs: 10000 });
            const env = createReferenceEnvironment(map);
            const result = solveFastMap(map, { nodeBudget: 30000, stateBudget: 30000, budgetMs: 10000 });
            assert.equal(result.status, 'solved', `${file} 没有通关证书`);
            const encoded = DataSerializer.generateShareCode(map);
            assert(encoded.success);
            const decoded = DataSerializer.loadFromShareCode(encoded.code);
            assert(decoded.success);
            const { mapData, gameMode, initialHealth } = decoded.data;
            const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth });
            assert.deepEqual(physicalState(restored.replay(result.solution.actions).state), physicalState(env.replay(result.solution.actions).state));
            ruleset = env.ruleset;
            return { mapId: env.mapId, familyId, file, sharecode: encoded.code };
        });
        if (random() < 0.5) candidates.reverse();
        return { id: `pair-${index + 1}`, a: candidates[0], b: candidates[1] };
    });
    const packet = { schemaVersion: 1, assignmentVersion: 'pair-review-v1', assignmentSeed: seed, ruleset, pairs };
    return { ...packet, id: packetId(packet) };
}

export function publicPacket(packet) {
    return { id: packet.id, pairs: packet.pairs.map(pair => ({ id: pair.id,
        a: { sharecode: pair.a.sharecode }, b: { sharecode: pair.b.sharecode } })) };
}
