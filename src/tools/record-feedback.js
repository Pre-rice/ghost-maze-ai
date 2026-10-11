#!/usr/bin/env node
/**
 * record-feedback - 记录用户试玩反馈
 *
 * 用法：
 *   node src/tools/record-feedback.js <map.json> "<反馈评语>" [得分0-10]
 *
 * 行为：
 *   1. 把反馈追加到 data/maps/<同名>.json 的 feedback 数组（含时间/评语/得分）
 *   2. 追加到 data/feedback/<同名>.md 人类可读记录
 *   3. 提示把提炼的教训写入 data/experience.md（训练循环的「记忆」）
 *
 * 反馈是训练循环的最终裁判信号——真人玩起来的真实感受，
 * 每次试玩后必须记录，用于调整评审标准与下一轮生成方向。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

const [file, comment, scoreArg] = process.argv.slice(2);
if (!file || !comment) {
    console.error('用法: node src/tools/record-feedback.js <map.json> "<反馈评语>" [得分0-10]');
    process.exit(2);
}
const score = scoreArg != null ? Number(scoreArg) : null;
if (score != null && (Number.isNaN(score) || score < 0 || score > 10)) {
    console.error('✗ 得分必须是 0–10 的数字');
    process.exit(2);
}

// ── 1. 更新地图存档 ────────────────────────────────
const mapsDir = join(repoRoot, 'data', 'maps');
const name = basename(file, '.json');
const target = join(mapsDir, `${name}.json`);

if (!existsSync(target)) {
    console.error(`✗ 地图存档不存在: ${target}\n   （先把地图存入 data/maps/ 再记录反馈）`);
    process.exit(1);
}
const record = {
    feedback: {
        time: new Date().toISOString().slice(0, 16).replace('T', ' '),
        comment,
        score
    }
};
const mapData = JSON.parse(readFileSync(target, 'utf-8'));
mapData.feedback = mapData.feedback || [];
mapData.feedback.push(record.feedback);
writeFileSync(target, JSON.stringify(mapData, null, 2));
console.log(`✓ 反馈已存入 ${target}`);

// ── 2. 人类可读反馈记录 ────────────────────────────
const fbDir = join(repoRoot, 'data', 'feedback');
mkdirSync(fbDir, { recursive: true });
const fbFile = join(fbDir, `${name}.md`);
const line = `- ${record.feedback.time} | 得分 ${score ?? '—'}/10 | ${comment}`;
appendFileSync(fbFile, line + '\n');
console.log(`✓ 已追加到 ${fbFile}`);

// ── 3. 提炼教训提示 ────────────────────────────────
console.log('\n▶ 下一步：把这条反馈里值得长期记住的教训（设计成功/失败原因）');
console.log('  提炼写入 data/experience.md —— 那是训练循环的「记忆」，');
console.log('  下一轮生成前会先读取它。');
