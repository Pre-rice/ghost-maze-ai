import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { aiMaps } from '../../ghost-maze/src/maps/ai-gallery.js';
import { mapFromSharecode, prepareDemonstration } from '../src/training/demonstration.js';
import { createReferenceEnvironment } from '../src/reference/environment.js';
import { ReplaySerializer } from '../src/reference/engine.js';
import { traceState } from '../src/review/trace-core.js';

// 只制备规划监督；名单与亲缘组来自已验收资料，未知家族不猜测拆分。
const [outputArgument, ...candidateFiles] = process.argv.slice(2);
if (!outputArgument) throw new TypeError('用法：node scripts/prepare-planning-library.mjs <新输出目录> [候选分享证书.json ...]');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(outputArgument);
assert(!existsSync(output), '输出目录已存在，拒绝覆盖');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const policy = read(root + 'data/manifests/puzzle-library-policy.json');
const allowed = new Set(policy.presentableMapIds);
const galleryFile = new URL('../../ghost-maze/src/maps/ai-gallery.js', import.meta.url);
const gallerySha256 = digest(readFileSync(galleryFile));
const sources = aiMaps.map(record => ({ ...record,
    sourceRole: 'approved_gallery_solver_reference', sourceFile: '../ghost-maze/src/maps/ai-gallery.js' }));
for (const filename of candidateFiles) {
    const share = read(filename);
    assert(typeof share.familyId === 'string' && share.familyId, '候选证书缺少家族');
    sources.push({ ...share, sourceRole: 'candidate_solver_reference', sourceFile: filename,
        humanFeedbackStatus: share.humanFeedback?.length ? 'feedback_available' : 'not_reviewed',
        galleryDecision: share.galleryStatus ?? 'not_added_requires_explicit_user_selection' });
}
const records = [], seen = new Set(), started = Date.now();
mkdirSync(output, { recursive: true });
for (const source of sources) {
    const map = mapFromSharecode(source.mapCode), env = createReferenceEnvironment(map);
    assert(!seen.has(env.mapId), '不能重复收录同一地图');
    seen.add(env.mapId);
    assert(allowed.has(env.mapId), '当前复用名单未通过');
    assert.equal(env.ruleset, policy.ruleset);
    const familyId = policy.planningFamilyIds?.[env.mapId];
    assert(typeof familyId === 'string' && familyId, '地图缺少已记录的规划拆分组');
    if (source.sourceRole === 'candidate_solver_reference') {
        assert.equal(source.mapId, env.mapId, '候选证书地图不一致');
        assert.equal(source.ruleset, env.ruleset, '候选证书规则不一致');
        assert.equal(source.familyId, familyId, '候选家族与当前拆分登记不一致');
    }
    const replay = ReplaySerializer.loadFromShareCode(map, source.replayCode);
    assert(replay.success, '参考操作码无效');
    if (source.actions) assert.deepEqual(replay.actions, source.actions, '证书动作与操作码不一致');
    const input = { schemaVersion: 1, coverage: 'retained_branch', id: 'solver-' + env.mapId.slice(0, 32),
        sharecode: source.mapCode, actions: replay.actions, final: traceState(env.replay(replay.actions).state) };
    const result = prepareDemonstration(input, { familyId, source: 'solver_certificate',
        budget: { nodeBudget: 500000, stateBudget: 550000, budgetMs: 30000 },
        boundaryBudget: { nodeBudget: 600000, budgetMs: 30000 } });
    const { rows, ...manifest } = result;
    const path = output + '/' + env.mapId;
    mkdirSync(path);
    Object.assign(manifest, { samples: rows.length, title: source.title, sourceFile: source.sourceFile,
        sourceRole: source.sourceRole, gallerySourceSha256: gallerySha256,
        humanFeedbackStatus: source.humanFeedbackStatus ?? 'gallery_selected_by_user',
        galleryDecision: source.galleryDecision ?? 'selected_by_user' });
    writeFileSync(path + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    const lines = rows.map(row => JSON.stringify(row)).join('\n') + '\n';
    writeFileSync(path + '/transitions.jsonl', lines, { flag: 'wx' });
    records.push({ title: source.title, mapId: env.mapId, familyId, splitGroup: familyId,
        source: 'solver_certificate', sourceRole: source.sourceRole, sourceFile: source.sourceFile,
        rows: rows.length, shortest: result.optimality.solution.totalActions,
        boundaryStatus: result.boundaries.status, qualityScore: null, rowsSha256: digest(lines),
        humanFeedbackStatus: manifest.humanFeedbackStatus, galleryDecision: manifest.galleryDecision,
        humanFeedbackSource: source.sourceRole === 'candidate_solver_reference' ? source.sourceFile : null,
        dataDirectory: outputArgument.replaceAll('\\', '/') + '/' + env.mapId });
    console.log(JSON.stringify({ title: source.title, rows: rows.length, boundary: result.boundaries.status, familyId }));
}
assert.equal(digest(readFileSync(galleryFile)), gallerySha256, '制备期间地图集发生变化');
const summary = { createdAtUtc: new Date().toISOString(), datasetVersion: 'demonstration-v3-physical-boundaries',
    ruleset: policy.ruleset, records, maps: records.length, rows: records.reduce((n, record) => n + record.rows, 0),
    conservativeSplitGroups: [...new Set(records.map(record => record.splitGroup))], galleryMaps: aiMaps.length,
    candidateMaps: records.length - aiMaps.length,
    unreviewedCandidates: records.filter(record => record.humanFeedbackStatus === 'not_reviewed').length,
    userRejectedCandidates: records.filter(record => record.galleryDecision === 'rejected_by_user').length,
    galleryUnchanged: true, gallerySourceSha256: gallerySha256,
    qualityScore: null, trainStarted: false, humanQualitySamplesAdded: 0, observationScope: 'full_information',
    policyTarget: 'one_optimal_continuation',
    scope: '只作规划监督，全部并列最优解边界通过、未知拒绝；各亲缘组整体拆分，不混作真人资料或质量标签',
    elapsedMs: Date.now() - started };
writeFileSync(output + '/summary.json', JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ complete: true, maps: summary.maps, rows: summary.rows,
    splitGroups: summary.conservativeSplitGroups.length, trainStarted: false, elapsedMs: summary.elapsedMs }));
