import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const choices = ['a', 'b', 'tie', 'cannot_judge'];
const playStates = ['unplayed', 'tried', 'completed'];
const exposures = ['none', 'some', 'both', 'unsure'];
const fail = message => { throw new TypeError(message); };

export function validateFeedback(packet, input) {
    const fields = ['eventId', 'packetId', 'pairId', 'choice', 'playedA', 'playedB', 'priorExposure', 'reason'];
    if (!input || typeof input !== 'object' || Array.isArray(input) || fields.some(k => !Object.hasOwn(input, k)) || Object.keys(input).some(k => !fields.includes(k))) fail('反馈字段不完整或含未知字段');
    if (typeof input.eventId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(input.eventId)) fail('事件标识非法');
    if (input.packetId !== packet.id) fail('试玩包已变化，请刷新页面');
    const pair = packet.pairs.find(p => p.id === input.pairId);
    if (!pair) fail('比较组不存在');
    if (!choices.includes(input.choice) || !playStates.includes(input.playedA) || !playStates.includes(input.playedB) || !exposures.includes(input.priorExposure)) fail('请选择比较结果、试玩情况和解答接触情况');
    if (input.choice !== 'cannot_judge' && [input.playedA, input.playedB].includes('unplayed')) fail('比较前请至少试玩两题；也可以选择暂时无法判断');
    if (typeof input.reason !== 'string' || input.reason.length > 2000) fail('理由最多 2000 字');
    // 字段顺序固定，重试时不会因 JSON 属性顺序误判冲突。
    return Object.fromEntries(fields.map(key => [key, input[key]]));
}

/** 单进程追加日志；每次改评保留历史，同一 eventId 的网络重试不重复记票。 */
export function createFeedbackStore(packet, file) {
    const records = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : [];
    const byEvent = new Map();
    for (const row of records) {
        if (row.schemaVersion !== 1 || row.packetId !== packet.id) fail('已有反馈不属于当前试玩包，拒绝混写');
        validateFeedback(packet, row.input);
        const pair = packet.pairs.find(p => p.id === row.input.pairId);
        if (row.source !== 'human_pairwise_ui' || row.ruleset !== packet.ruleset ||
            row.a?.mapId !== pair.a.mapId || row.b?.mapId !== pair.b.mapId ||
            row.a?.familyId !== pair.a.familyId || row.b?.familyId !== pair.b.familyId) fail('已有反馈的地图绑定或规则版本不一致');
        if (byEvent.has(row.input.eventId)) fail('已有日志包含重复事件');
        byEvent.set(row.input.eventId, row);
    }
    const latest = () => Object.fromEntries(records.map(row => [row.input.pairId, row]));
    return {
        latest,
        save(input) {
            const normalized = validateFeedback(packet, input), old = byEvent.get(normalized.eventId);
            if (old) {
                if (JSON.stringify(old.input) !== JSON.stringify(normalized)) fail('事件标识已用于另一条反馈');
                return old;
            }
            const pair = packet.pairs.find(p => p.id === input.pairId);
            const row = { schemaVersion: 1, source: 'human_pairwise_ui', packetId: packet.id, ruleset: packet.ruleset,
                recordedAt: new Date().toISOString(), replaces: latest()[input.pairId]?.input.eventId ?? null,
                a: { mapId: pair.a.mapId, familyId: pair.a.familyId }, b: { mapId: pair.b.mapId, familyId: pair.b.familyId }, input: normalized };
            mkdirSync(dirname(file), { recursive: true });
            appendFileSync(file, JSON.stringify(row) + '\n', 'utf8');
            records.push(row); byEvent.set(normalized.eventId, row);
            return row;
        },
        export() {
            const current = Object.values(latest());
            return { schemaVersion: 1, packetId: packet.id, ruleset: packet.ruleset, records: structuredClone(records),
                comparisons: current.filter(row => row.input.choice !== 'cannot_judge').map(row => ({
                    eventId: row.input.eventId, a: row.a, b: row.b,
                    preferenceForA: row.input.choice === 'a' ? 1 : row.input.choice === 'b' ? 0 : 0.5,
                    firstExposure: row.input.priorExposure === 'none', playedA: row.input.playedA, playedB: row.input.playedB,
                    reason: row.input.reason
                })) };
        }
    };
}
