import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPacket, packetId, publicPacket } from '../../src/review/packet.js';
import { createFeedbackStore, validateFeedback } from '../../src/review/feedback.js';
import { startReviewServer } from '../../src/review/server.mjs';
import { verticalRelayMap, hypotheses } from '../../examples/vertical-relay/build.mjs';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';

// 新结构仅写入临时测试目录，不覆盖有冲突的历史原图或原试玩包。
const fixtureDirectory = mkdtempSync(join(tmpdir(), 'ghost-review-maps-'));
const fixtureFiles = [false, true].map(control => {
    const file = join(fixtureDirectory, control ? 'control.json' : 'relay.json');
    writeFileSync(file, JSON.stringify(verticalRelayMap(control)), { flag: 'wx' });
    return pathToFileURL(file).href;
});
const groups = [
    ['lure-loop-v1', 'examples/puzzle-units/unit-01.json', 'examples/puzzle-units/unit-02.json'],
    ['complementary-switch-v1', 'examples/mechanism-lab/complementary-switch.json', 'examples/mechanism-lab/bypass-control.json'],
    ['vertical-relay-v1', ...fixtureFiles]
];
const packet = buildPacket(20260930, groups);
const packetFile = join(fixtureDirectory, 'packet.json');
writeFileSync(packetFile, JSON.stringify(packet), { flag: 'wx' });
const temp = () => join(mkdtempSync(join(tmpdir(), 'ghost-review-test-')), 'feedback.jsonl');
const input = (overrides = {}) => ({ eventId: 'test-event-0001', packetId: packet.id, pairId: packet.pairs[0].id,
    choice: 'a', playedA: 'completed', playedB: 'tried', priorExposure: 'none', reason: '自动化测试，不是真实偏好', ...overrides });

test('跨层家族的解与必要性由 BFS / A* 分别确认，对照仍需跨层取钥匙', () => {
    const budget = { nodeBudget: 30000, stateBudget: 30000, budgetMs: 60000 };
    for (const control of [false, true]) {
        const map = verticalRelayMap(control);
        for (const solver of [solveFastMap, solveReferenceMap]) {
            assert.equal(solver(map, budget).solution.totalActions, control ? 9 : 12);
            for (const hypothesis of hypotheses) {
                const result = solver(map, { ...budget, restrictions: [hypothesis] });
                assert.equal(result.status, control && hypothesis.id === 'press_A' ? 'solved' : 'proven_unsat');
            }
        }
    }
});

test('试玩包固定侧序与地图绑定，公开投影没有解法、家族或设计名称', () => {
    assert.deepEqual(buildPacket(packet.assignmentSeed, groups), packet);
    assert.equal(packet.id, packetId(packet));
    const view = publicPacket(packet), text = JSON.stringify(view);
    assert.equal(view.pairs.length, 3);
    for (const term of ['familyId', 'solution', 'mapId', 'source', 'remote-switch', 'counterfactual']) assert(!text.includes(term));
    const families = new Set();
    for (const pair of packet.pairs) {
        assert.equal(pair.a.familyId, pair.b.familyId);
        families.add(pair.a.familyId);
        for (const side of ['a', 'b']) {
            const map = JSON.parse(readFileSync(new URL(pair[side].file, new URL('../../', import.meta.url)), 'utf8'));
            assert.equal(createReferenceEnvironment(map).mapId, pair[side].mapId);
        }
    }
    assert.equal(families.size, 3);
});

test('试玩包拒绝原始楼梯冲突，保留历史原图和原包', () => {
    const files = ['examples/vertical-relay/remote-switch.json', 'examples/vertical-relay/local-key-control.json',
        'examples/review-batch-01/packet.json'].map(file => new URL(`../../${file}`, import.meta.url));
    const original = files.map(file => readFileSync(file, 'utf8'));
    assert.throws(() => buildPacket(), /层内与全局楼梯数据冲突/);
    assert.deepEqual(files.map(file => readFileSync(file, 'utf8')), original);
    const invalidFile = join(fixtureDirectory, 'conflicting-stairs.json');
    const map = verticalRelayMap(); map.layers[0].stairs = [];
    writeFileSync(invalidFile, JSON.stringify(map), { flag: 'wx' });
    assert.throws(() => buildPacket(20260930, [['invalid', pathToFileURL(invalidFile).href, fixtureFiles[0]]]), /层内与全局楼梯数据冲突/);
});

test('未试玩不能强制投票；无法判断与平局分开，旧包和伪造字段被拒绝', () => {
    for (const change of [{ playedA: 'unplayed' }, { packetId: 'old' }, { choice: 'solved' }, { pairId: 'missing' }, { score: 1 }, { reason: 'x'.repeat(2001) }]) {
        assert.throws(() => validateFeedback(packet, input(change)), TypeError);
    }
    assert.equal(validateFeedback(packet, input({ choice: 'cannot_judge', playedA: 'unplayed', playedB: 'unplayed' })).choice, 'cannot_judge');
});

test('保存、重试、修改与重启不会重复计票，地图标签来自固定包', () => {
    const file = temp(), store = createFeedbackStore(packet, file);
    assert.deepEqual(store.export().comparisons, []);
    const first = store.save(input());
    assert.equal(store.save(input()).recordedAt, first.recordedAt);
    assert.equal(store.export().records.length, 1);
    assert.throws(() => store.save(input({ choice: 'b' })), /另一条反馈/);
    store.save(input({ eventId: 'test-event-0002', choice: 'b', priorExposure: 'some' }));
    const restarted = createFeedbackStore(packet, file), result = restarted.export();
    assert.equal(result.records.length, 2);
    assert.equal(result.records[1].replaces, 'test-event-0001');
    assert.equal(result.comparisons.length, 1);
    assert.equal(result.comparisons[0].preferenceForA, 0);
    assert.equal(result.comparisons[0].firstExposure, false);
    assert.equal(result.comparisons[0].a.mapId, packet.pairs[0].a.mapId);
    store.save(input({ eventId: 'test-event-0003', choice: 'cannot_judge' }));
    assert.equal(store.export().comparisons.length, 0);
});

test('平局导出 0.5；损坏或错绑地图的历史日志不能混入数据', () => {
    const file = temp(), store = createFeedbackStore(packet, file);
    store.save(input({ choice: 'tie' }));
    assert.equal(store.export().comparisons[0].preferenceForA, 0.5);
    const record = store.export().records[0]; record.a.mapId = 'forged';
    writeFileSync(file, JSON.stringify(record) + '\n');
    assert.throws(() => createFeedbackStore(packet, file), /地图绑定/);
});

test('本地服务提供原游戏与离线依赖，反馈接口隔离来源且不泄露证书', async t => {
    const file = temp();
    const { server, origin } = await startReviewServer({ port: 0, packetFile, feedbackFile: file });
    t.after(() => { server.closeAllConnections(); server.close(); });
    const game = await (await fetch(`${origin}/game/`)).text();
    assert(game.includes('src/vendor/pako.js'));
    assert(!game.includes('cdnjs.cloudflare'));
    for (const path of ['/game/src/vendor/pako.js', '/game/src/main.js', '/game/styles.css', '/game/maps.html', '/game/src/maps/gallery.js', '/game/src/maps/ai-gallery.js', '/']) assert.equal((await fetch(origin + path)).status, 200);
    for (const path of ['/examples/vertical-relay/evidence.json', '/packet.json', '/game/.git', '/game/%2e%2e%2fengine.lock.json']) assert.equal((await fetch(origin + path)).status, 404);
    const feedback = await (await fetch(`${origin}/api/feedback`)).json();
    assert.deepEqual(feedback, {});
    const save = async (data, requestOrigin = origin) => fetch(`${origin}/api/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: requestOrigin }, body: JSON.stringify(data)
    });
    assert.equal((await save(input(), 'https://example.com')).status, 403);
    assert.equal((await save(input({ playedA: 'unplayed' }))).status, 400);
    assert.equal((await save(input())).status, 200);
    assert.equal((await save(input())).status, 200);
    const result = await (await fetch(`${origin}/api/export`)).json();
    assert.equal(result.records.length, 1);
    const visible = JSON.stringify(await (await fetch(`${origin}/api/feedback`)).json());
    assert(!visible.includes('familyId'));
    assert(!visible.includes('mapId'));
});

test('本体预览从指定目录提供页面与本地 pako，反馈与录制仍写独立测试目录', async t => {
    const directory = mkdtempSync(join(tmpdir(), 'ghost-preview-test-'));
    const webGameRoot = join(directory, 'game');
    mkdirSync(join(webGameRoot, 'src/vendor'), { recursive: true });
    writeFileSync(join(webGameRoot, 'index.html'), '<body><script src="src/vendor/pako.js"></script></body>', { flag: 'wx' });
    writeFileSync(join(webGameRoot, 'src/vendor/pako.js'), '// 测试本地依赖', { flag: 'wx' });
    writeFileSync(join(webGameRoot, 'src/main.js'), '// 测试本体预览', { flag: 'wx' });
    const { server, origin } = await startReviewServer({ port: 0, packetFile, webGameRoot,
        feedbackFile: join(directory, 'feedback.jsonl'), recordingsDir: join(directory, 'recordings') });
    t.after(() => { server.closeAllConnections(); server.close(); });
    const html = await (await fetch(origin + '/game/')).text();
    assert(html.includes('src="src/vendor/pako.js"'));
    assert(html.includes('/recorder.js'));
    assert(!html.includes('cdnjs.cloudflare'));
    for (const path of ['/game/src/main.js', '/game/src/vendor/pako.js']) {
        const response = await fetch(origin + path);
        assert.equal(response.status, 200);
        assert((await response.text()).startsWith('// 测试'));
    }
    assert.deepEqual(await (await fetch(origin + '/api/recordings')).json(), []);
    assert.equal((await fetch(origin + '/game/src/../../engine.lock.json')).status, 404);
});
