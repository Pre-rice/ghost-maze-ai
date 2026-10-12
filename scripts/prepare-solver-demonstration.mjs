import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createReferenceEnvironment } from '../src/reference/environment.js';
import { ReplaySerializer } from '../src/reference/engine.js';
import { traceState } from '../src/review/trace-core.js';
import { prepareDemonstration, mapFromSharecode } from '../src/training/demonstration.js';

// 求解器证书独立导入，绝不写入真人录制／反馈目录。
try {
    const [mapFile, certificateFile, outputDirectory, familyId, ...extra] = process.argv.slice(2);
    if (!mapFile || !certificateFile || !outputDirectory || !familyId || extra.length) {
        throw new TypeError('用法：node scripts/prepare-solver-demonstration.mjs <地图.json> <分享证书.json> <新输出目录> <familyId>');
    }
    if (existsSync(outputDirectory)) throw new TypeError('输出目录已存在，请使用新目录，避免覆盖');
    const mapRaw = readFileSync(mapFile), certificateRaw = readFileSync(certificateFile);
    const map = JSON.parse(mapRaw), certificate = JSON.parse(certificateRaw);
    const env = createReferenceEnvironment(map);
    assert.equal(certificate.mapId, env.mapId, '证书不是当前地图');
    assert.equal(certificate.ruleset, env.ruleset, '证书不属于当前规则');
    if (certificate.familyId) assert.equal(certificate.familyId, familyId, '亲缘题必须沿用证书家族');
    assert.equal(createReferenceEnvironment(mapFromSharecode(certificate.mapCode)).mapId, env.mapId, '地图分享码与文件不一致');
    assert(Array.isArray(certificate.actions), '证书缺少动作');
    if (certificate.replayCode) {
        const replay = ReplaySerializer.loadFromShareCode(map, certificate.replayCode);
        assert(replay.success, '操作码无效');
        assert.deepEqual(replay.actions, certificate.actions, '操作码与证书动作不一致');
    }
    const id = 'solver-' + env.mapId.slice(0, 32);
    const input = { schemaVersion: 1, coverage: 'retained_branch', id,
        sharecode: certificate.mapCode, actions: certificate.actions,
        final: traceState(env.replay(certificate.actions).state) };
    const result = prepareDemonstration(input, { familyId, source: 'solver_certificate',
        budget: { nodeBudget: 250000, stateBudget: 300000, budgetMs: 30000 } });
    const { rows, ...manifest } = result;
    manifest.samples = rows.length;
    manifest.sourceMapFile = mapFile;
    manifest.sourceCertificateFile = certificateFile;
    manifest.sourceMapSha256 = createHash('sha256').update(mapRaw).digest('hex');
    manifest.sourceCertificateSha256 = createHash('sha256').update(certificateRaw).digest('hex');
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(resolve(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    writeFileSync(resolve(outputDirectory, 'transitions.jsonl'), rows.map(row => JSON.stringify(row)).join('\n') + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ source: manifest.source, mapId: manifest.mapId, familyId,
        samples: rows.length, boundaries: manifest.boundaries.status,
        qualityScore: manifest.qualityScore, trainStarted: manifest.trainStarted }));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
