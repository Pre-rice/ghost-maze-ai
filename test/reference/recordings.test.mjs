import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ActionHistory, GameLogic, DataSerializer } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { traceState } from '../../src/review/trace-core.js';
import { recoverBranch, traceAction } from '../../src/review/historical-trace.js';
import { createRecordingStore, verifyRecording } from '../../src/review/recordings.js';
import { startReviewServer } from '../../src/review/server.mjs';
import { buildPacket } from '../../src/review/packet.js';

const read = file => JSON.parse(readFileSync(new URL(`../../examples/coupled-singlelayer/${file}`, import.meta.url), 'utf8'));
const map = read('map.json'), evidence = read('evidence.json');
const env = createReferenceEnvironment(map);
function history(actions) {
    const states = [env.initialState()];
    for (const token of actions) states.push(GameLogic.calculateNextState(states.at(-1), traceAction(token), env.mapDefinition));
    return states;
}
function recording(actions = evidence.analysis.baseline.solution.actions, id = 'recording-test-001') {
    return { schemaVersion: 1, id, coverage: 'retained_branch', capturedAt: '2026-09-30T00:00:00Z', sharecode: DataSerializer.generateShareCode(map).code,
        actions, ambiguities: [], final: traceState(new ActionHistory(env.mapDefinition,actions).stateAt(actions.length)) };
}

test('直接记录操作，原地按钮的三个回合全部计入步数', () => {
    const recovered = recording();
    assert.deepEqual(recovered.actions, evidence.analysis.baseline.solution.actions);
    const result = verifyRecording(recovered);
    assert(result.cleanWin);
    assert.equal(result.totalActions, 37); assert.equal(result.movementCost, 34);
    assert.deepEqual(result.steps.filter(s => s.button).map(s => s.button), ['B', 'A', 'B']);
    const last = result.steps.filter(s => s.button).at(-1);
    assert.deepEqual(last.playerBefore, last.playerAfter);
    assert.notDeepEqual(last.ghostsBefore, last.ghostsAfter);
});

test('撤回后只恢复当前分支，渲染轨迹裁剪不影响历史识别', () => {
    const original = history(evidence.analysis.baseline.solution.actions);
    for (const state of original) { state.player.trail = []; state.layerStates[0].ghosts.forEach(g => { g.trail = []; }); }
    const branch = recoverBranch(original.slice(0, 6), env.mapDefinition, GameLogic);
    assert.deepEqual(branch.actions, evidence.analysis.baseline.solution.actions.slice(0, 5));
    assert.equal(branch.final.isWon, false);
    assert.throws(() => recoverBranch(original.slice(2), env.mapDefinition, GameLogic), /初始状态/);
});

test('死亡与复活可以如实记录，但不得冒充无伤证书；篡改终局或非法动作被拒绝', () => {
    const failed = read('evidence.json').failedPlans[0].actions;
    const revived = recording(failed);
    assert.equal(verifyRecording(revived).cleanWin, false);
    const bad = recording(); bad.final.player.x = 0;
    assert.throws(() => verifyRecording(bad), /终局/);
    assert.throws(() => verifyRecording({ ...recording(), actions: ['PRESS_BUTTON'] }), /未知/);
    assert.throws(() => verifyRecording({ ...recording(), actions: [...recording().actions, 'R'] }), /多余动作/);
});

test('录制独立保存，重试幂等且拒绝覆盖另一条路线', () => {
    const store = createRecordingStore(mkdtempSync(join(tmpdir(), 'ghost-recording-test-')));
    const input = recording(); const saved = store.save(input);
    assert.equal(store.save(input).savedAt, saved.savedAt);
    assert.equal(store.list().length, 1);
    assert.deepEqual(store.get(input.id).input, input);
    assert.throws(() => store.save({ ...input, capturedAt: 'changed' }), /拒绝覆盖/);
    assert.throws(() => store.get('../recording-test-001'), /标识/);
});

test('录制服务注入独立模块，不改游戏文件，并可校验保存和加载回放', async t => {
    const temp = mkdtempSync(join(tmpdir(), 'ghost-recording-http-'));
    const packet = buildPacket(20260930, [['recorder-test', 'examples/puzzle-units/unit-01.json', 'examples/puzzle-units/unit-02.json']]);
    const packetFile = join(temp, 'packet.json');
    writeFileSync(packetFile, JSON.stringify(packet), { flag: 'wx' });
    const { server, origin } = await startReviewServer({ port: 0, packetFile, feedbackFile: join(temp, 'feedback.jsonl'), recordingsDir: join(temp, 'solutions') });
    t.after(() => { server.closeAllConnections(); server.close(); });
    assert((await (await fetch(origin + '/game/')).text()).includes('/recorder.js'));
    for (const path of ['/recorder.js', '/trace-core.js', '/game/src/editorMain.js']) assert.equal((await fetch(origin + path)).status, 200);
    const input = recording();
    const response = await fetch(origin + '/api/recordings', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(input) });
    assert.equal(response.status, 200, await response.clone().text());
    assert((await response.json()).verified.cleanWin);
    assert.equal((await (await fetch(origin + '/api/recordings')).json()).length, 1);
    assert.deepEqual((await (await fetch(origin + '/api/recordings/' + input.id)).json()).input.actions, input.actions);
});
