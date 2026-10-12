import { readFileSync } from 'node:fs';
import { auditPuzzleBoundaries } from '../src/design/rule-boundaries.js';

const filename = process.argv[2];
if (!filename) throw new Error('用法：node scripts/verify-puzzle-boundaries.mjs 地图.json');
const record = JSON.parse(readFileSync(filename, 'utf8'));
const result = auditPuzzleBoundaries(record.map || record.mapData || record);
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.status === 'safe' ? 0 : result.status === 'unknown' ? 3 : 1;
