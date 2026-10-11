import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { importHistoricalRecording } from '../src/review/import-recording.js';
import { verifyRecording } from '../src/review/recordings.js';
import { ReplaySerializer, DataSerializer } from '../src/reference/engine.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'data/generated/recordings-current');
const origin = process.argv[2] || 'http://127.0.0.1:4206/game/';
const read = file => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// 原图关联来自原验收的录制地图标识；不尝试解读旧码或按终局猜地图。
const sources = new Map([
    ['836152c49e3bb2ee120730a0e86346f38f5809f05560b6ba5ce77a39ef5972ac', 'solid-units-20261008/unit-01'],
    ['7870b98c7cd4acd8efb6d098c5b6708b545a67a424ab8d8a1cebfb97dd0f91e4', 'solid-units-20261008/unit-02'],
    ['f308cd1894cf54e70ea7551be28db3a0f060de4d2e658ac1624585199e4c9d95', 'interlocked-singlelayer-20261008/map'],
    ['1a7393b284bf1fa6faba807ad6f0032e15150d1011fd6e87f0b89ef5b011e7e2', 'return-to-source-20261010/map'],
    ['4d7298f6521f514e2c640935392a7f0a5cc8c007403d8025bcbbeb2964914ac2', 'twin-handoff-20261009/map'],
    ['68b83f37974d5ae2a2a8e4f6068ed781fac1baf034c113621383bc5945319057', 'user-refinements/user-01'],
    ['d9d29044e5c3ac2d9b13b62b4cd50978f8cad05c34b7ce3fead2261ebe54db16', 'gate-handoff-20261008/map'],
    ['55c9e888052fb72030003416fcd06891afcf4d432e95a72bb5cd83f04adda1ad', 'single-station-relay-20261010/map'],
    ['02a9afadced9e97c5be598e3071c56fbf828e53df6dfd611c66622722d005e53', 'permanent-return-20261009/map'],
    ['114539d00604f8f3a3785ce625e7e4ef0bbf86a580202e2f97f18ef816f81200', 'shelter-exchange-20261010/map']
]);
const minimal = read('examples/minimal-units-20261007/manifest.json');
const report = { source: 'human_recording', maps: [], rejected: [] };
mkdirSync(output, { recursive: true });
for (const file of readdirSync(resolve(root, 'data/solutions')).filter(file => file.endsWith('.json')).sort()) {
    const sourceFile = 'data/solutions/' + file, bytes = readFileSync(resolve(root, sourceFile));
    const original = JSON.parse(bytes), input = original.input;
    const unit = minimal.find(row => row.sharecode === input.sharecode);
    const mapFile = unit ? 'examples/minimal-units-20261007/unit-' + unit.id + '.json' :
        sources.has(original.verified.mapId) ? 'examples/' + sources.get(original.verified.mapId) + '.json' : null;
    try {
        if (!mapFile) throw new Error('没有明确的原图关联，拒绝猜测');
        const mapBytes = readFileSync(resolve(root, mapFile)), imported = importHistoricalRecording(input, JSON.parse(mapBytes));
        const verified = verifyRecording(imported);
        const map = DataSerializer.loadFromShareCode(imported.sharecode).data.mapData;
        const replay = ReplaySerializer.generateShareCode(map, imported.actions); assert(replay.success, replay.error);
        const ancestry = { sourceFile, sourceSha256: sha(bytes), sourceMap: mapFile, sourceMapSha256: sha(mapBytes) };
        const result = { source: 'human_recording', ancestry, input: imported, verified, replayCode: replay.code };
        const destination = resolve(output, file), content = JSON.stringify(result, null, 2) + '\n';
        if (existsSync(destination)) assert.equal(readFileSync(destination, 'utf8'), content, '迁移目标已有不同内容，拒绝覆盖');
        else writeFileSync(destination, content, { flag: 'wx' });
        report.maps.push({ ...ancestry, migratedFile: relative(root, destination).replaceAll('\\', '/'),
            actions: imported.actions.length, originalActions: input.actions.length, ambiguities: imported.ambiguities.length,
            won: verified.won, cleanWin: verified.cleanWin, mapCode: imported.sharecode, replayCode: replay.code,
            replayURL: origin + '?map=' + imported.sharecode + '&replay=' + replay.code });
        assert.equal(sha(readFileSync(resolve(root, mapFile))), ancestry.sourceMapSha256);
    } catch (error) { report.rejected.push({ sourceFile, sourceMap: mapFile, reason: error.message }); }
    assert.equal(sha(readFileSync(resolve(root, sourceFile))), sha(bytes), '原始录制必须保持原样');
}
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ migrated: report.maps.length, rejected: report.rejected }));
if (report.rejected.length) process.exitCode = 1;
