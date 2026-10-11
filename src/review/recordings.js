import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSerializer, GameLogic, WALL_TYPES, replayStep } from '../reference/engine.js';
import { createReferenceEnvironment } from '../reference/environment.js';
import { traceState } from './trace-core.js';
import { describeStep } from './step-description.js';

export function verifyRecording(input) {
    if (!input || input.schemaVersion !== 1 || input.coverage !== 'retained_branch' ||
        !/^[a-zA-Z0-9-]{8,80}$/.test(input.id) || typeof input.id !== 'string' ||
        typeof input.sharecode !== 'string' || input.sharecode.length > 100000 ||
        !Array.isArray(input.actions) || input.actions.length > 2000) throw new TypeError('录制格式非法');
    const decoded = DataSerializer.loadFromShareCode(input.sharecode);
    if (!decoded.success) throw new TypeError('录制中的地图分享码无效');
    const { mapData, gameMode, initialHealth } = decoded.data;
    const env = createReferenceEnvironment({ ...mapData, gameMode, initialHealth });
    let state = env.initialState(), clean = true, movementCost = 0;
    const steps = [];
    for (const token of input.actions) {
        let base = state;
        if (state.isDead) { clean = false; base = GameLogic.handleRevive(state, env.mapDefinition); }
        let next;
        try { next = replayStep(state, token, env.mapDefinition, steps.length + 1); }
        catch (error) { throw new TypeError('录制包含无效或未知动作、或终止后的多余动作：' + error.message); }
        if (next.player.x !== base.player.x || next.player.y !== base.player.y || next.player.layer !== base.player.layer) movementCost++;
        if (next === state) throw new TypeError('录制包含无效动作或终止后的多余动作');
        steps.push(describeStep(base, next, token, env.mapDefinition, WALL_TYPES));
        if (next.isDead) clean = false;
        state = next;
    }
    if (JSON.stringify(traceState(state)) !== JSON.stringify(input.final)) throw new TypeError('录制终局与原引擎重放不一致');
    return { ruleset: env.ruleset, mapId: env.mapId, won: state.isWon, cleanWin: clean && state.isWon,
        totalActions: input.actions.length, movementCost, steps };
}

export function createRecordingStore(directory) {
    const path = id => {
        if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(id)) throw new TypeError('录制标识非法');
        return resolve(directory, `${id}.json`);
    };
    return {
        save(input) {
            const file = path(input?.id);
            if (existsSync(file)) {
                const old = JSON.parse(readFileSync(file, 'utf8'));
                if (JSON.stringify(old.input) !== JSON.stringify(input)) throw new TypeError('录制标识已使用，拒绝覆盖');
                return old;
            }
            const verified = verifyRecording(input);
            const result = { schemaVersion: 1, source: 'browser_retained_history', savedAt: new Date().toISOString(), input, verified };
            mkdirSync(directory, { recursive: true });
            writeFileSync(file, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
            return result;
        },
        get(id) { return JSON.parse(readFileSync(path(id), 'utf8')); },
        list() {
            if (!existsSync(directory)) return [];
            return readdirSync(directory).filter(name => /^[a-zA-Z0-9-]+\.json$/.test(name)).map(name => {
                const row = JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
                return { id: row.input.id, savedAt: row.savedAt, ...Object.fromEntries(['mapId', 'won', 'cleanWin', 'totalActions', 'movementCost'].map(k => [k, row.verified[k]])) };
            }).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        }
    };
}
