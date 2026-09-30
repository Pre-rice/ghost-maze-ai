import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const read = file => JSON.parse(readFileSync(new URL(file, root), 'utf8'));

export function checkEnvironment() {
    const lock = read('engine.lock.json');
    const enginePath = fileURLToPath(new URL(lock.path + '/', root));
    const git = (...args) => execFileSync('git', ['-C', enginePath, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const revision = git('rev-parse', 'HEAD');
    if (revision !== lock.revision) throw new Error(`参考引擎版本不符：期望 ${lock.revision}，实际 ${revision}`);
    if (git('status', '--porcelain')) throw new Error('参考引擎有未提交改动，不能作为固定版本运行');
    const manifest = read('data/manifests/seed-units.json');
    if (manifest.ruleset !== revision) throw new Error('种子证书与参考引擎版本不符');
    for (const seed of manifest.seeds) {
        const hash = createHash('sha256').update(JSON.stringify(read(seed.file))).digest('hex');
        if (hash !== seed.sha256) throw new Error(`种子内容已变化，需要重新验证：${seed.id}`);
    }
    return { revision, seeds: manifest.seeds.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const result = checkEnvironment();
        console.log(`✓ 参考引擎 ${result.revision}，${result.seeds} 个种子内容与版本一致`);
    } catch (error) {
        console.error(`✗ ${error.message}\n请先执行 git submodule update --init --recursive，并检查 engine.lock.json。`);
        process.exitCode = 1;
    }
}
