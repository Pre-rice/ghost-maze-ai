import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { prepareDemonstration } from '../src/training/demonstration.js';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
    const [sourceFile, outputDirectory, familyId, ...extra] = process.argv.slice(2);
    if (!sourceFile || !outputDirectory || !familyId || extra.length) throw new TypeError('用法：node scripts/prepare-user-demonstration.mjs <data/solutions/录制.json> <新输出目录> <familyId>');
    const sourcePath = realpathSync(resolve(sourceFile));
    const sourceRelative = relative(realpathSync(resolve(root, 'data/solutions')), sourcePath);
    if (isAbsolute(sourceRelative) || sourceRelative.startsWith('..')) throw new TypeError('人类示范只能从真实解法目录导入，不能从 runs 中导入测试录制');
    if (existsSync(outputDirectory)) throw new TypeError('输出目录已存在，请使用新的目录，避免覆盖');
    const raw = readFileSync(sourcePath), recorded = JSON.parse(raw.toString('utf8'));
    const result = prepareDemonstration(recorded.input, { familyId, source: 'human_recording',
        budget: { nodeBudget: 100000, stateBudget: 100000, budgetMs: 30000 } });
    const { rows, ...manifest } = result;
    manifest.sourceFile = relative(root, sourcePath).replaceAll('\\', '/');
    manifest.sourceSha256 = createHash('sha256').update(raw).digest('hex');
    manifest.samples = rows.length;
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(resolve(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    writeFileSync(resolve(outputDirectory, 'transitions.jsonl'), rows.map(row => JSON.stringify(row)).join('\n') + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ mapId: manifest.mapId, samples: rows.length, stationaryActions: result.temporal.stationaryActions,
        causal: result.causal.counterfactuals.map(c => [c.hypothesis.id, c.conclusion]), relaxedPlan: result.relaxedDiagnostic.replayOnOriginal }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
