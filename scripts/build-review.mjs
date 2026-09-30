import { mkdirSync, writeFileSync } from 'node:fs';
import { buildPacket } from '../src/review/packet.js';

const packet = buildPacket();
const directory = new URL('../examples/review-batch-01/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('packet.json', directory), JSON.stringify(packet, null, 2) + '\n');
console.log(`已验证 ${packet.pairs.length} 组、${packet.pairs.length * 2} 张地图：${packet.id}`);
