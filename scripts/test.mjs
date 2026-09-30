import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let failed = false;
const referenceFiles = readdirSync(new URL('../test/reference/', import.meta.url)).filter(file => file.endsWith('.test.mjs')).sort().map(file => `test/reference/${file}`);
const suites = [
    ['固定版本参考验证', ['--test', ...referenceFiles]],
    ['原有验证与工具回归（物理对照已改为固定游戏引擎）', ['test/run-all.mjs']]
];
for (const [name, args] of (process.argv.includes('--reference-only') ? suites.slice(0, 1) : suites)) {
    console.log(`\n${name}`);
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) failed = true;
}
if (failed) process.exitCode = 1;
