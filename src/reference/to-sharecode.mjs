import { readFileSync } from 'node:fs';
import { DataSerializer } from './engine.js';
import { checkEnvironment } from '../../scripts/check-environment.mjs';

const [file, flag] = process.argv.slice(2);
if (!file) {
    console.error('用法：npm run sharecode -- <map.json> [--verify]');
    process.exit(2);
}
checkEnvironment();
const data = JSON.parse(readFileSync(file, 'utf8'));
const map = data.mapData || data;
const encoded = DataSerializer.generateShareCode(map);
if (!encoded.success) throw new Error(encoded.error);
console.log(encoded.code);
if (flag === '--verify') {
    const decoded = DataSerializer.loadFromShareCode(encoded.code);
    if (!decoded.success) throw new Error(decoded.error);
    console.log('✓ 固定版本游戏编解码通过；此命令不证明地图可解');
}
