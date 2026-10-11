import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root = new URL('../', import.meta.url);
const read = file => JSON.parse(readFileSync(new URL(file, root), 'utf8'));
export function checkEnvironment() {
    const lock = read('engine.lock.json');
    if (lock.path !== '../ghost-maze') throw new Error('引擎必须指向共同游戏本体');
    const digest = createHash('sha256');
    for (const [file, expected] of Object.entries(lock.files)) {
        const actual = createHash('sha256').update(readFileSync(new URL(lock.path + '/' + file, root))).digest('hex');
        if (actual !== expected) throw new Error(`共同引擎文件已变化：${file}；升级后重新验证并更新内容锁`);
        digest.update(file + ':' + actual + '\n');
    }
    const revision = 'sha256:' + digest.digest('hex');
    if (revision !== lock.revision) throw new Error('引擎内容锁不一致');
    const manifest = read('data/manifests/seed-units.json');
    if (manifest.ruleset !== revision) throw new Error('当前种子验证与共同引擎内容锁不一致');
    for (const seed of manifest.seeds) {
        const hash = createHash('sha256').update(JSON.stringify(read(seed.file))).digest('hex');
        if (hash !== seed.sha256) throw new Error(`原始种子内容已变化：${seed.id}`);
    }
    return { revision, seeds: manifest.seeds.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {const result=checkEnvironment();console.log(`✓ 共同引擎内容锁一致，${result.seeds} 份原始种子未变化`);}
    catch(error){console.error('✗ '+error.message);process.exitCode=1;}
}
