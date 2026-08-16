#!/usr/bin/env node
/**
 * to-sharecode - 地图 JSON → 分享码（粘贴进游戏试玩）
 *
 * 用法：
 *   node src/tools/to-sharecode.js <map.json>
 *   node src/tools/to-sharecode.js <map.json> --verify   # 输出后再解码验证闭环
 *
 * 产出分享码后：打开 https://ghostmaze.novic.cc ，把分享码粘贴进
 * 「粘贴并加载」输入框（或直接 ?map=<code> URL）即可试玩。
 */
import { readFileSync } from 'node:fs';
import { generateShareCode, loadFromShareCode } from './sharecode.js';

const [file, flag] = process.argv.slice(2);
if (!file) {
    console.error('用法: node src/tools/to-sharecode.js <map.json> [--verify]');
    process.exit(2);
}

const raw = readFileSync(file, 'utf-8');
const data = JSON.parse(raw);
const mapData = (data.mapData && typeof data.mapData === 'object' && data.mapData.hWalls) ? data.mapData : data;

const result = generateShareCode(mapData);
if (!result.success) {
    console.error(`✗ 生成失败: ${result.error}`);
    process.exit(1);
}
console.log(result.code);
console.log('\n（粘贴到游戏 https://ghostmaze.novic.cc 的「粘贴并加载」即可试玩）');

if (flag === '--verify') {
    const back = loadFromShareCode(result.code);
    if (!back.success) {
        console.error(`✗ 闭环校验失败: ${back.error}`);
        process.exit(1);
    }
    const d = back.data.mapData;
    console.log(`✓ 闭环校验通过: ${d.width}×${d.height} ${back.data.gameMode}，`
        + `钥匙${d.items.length} 鬼${d.initialGhosts.length} 终点(${d.endPos.x},${d.endPos.y})`);
}
