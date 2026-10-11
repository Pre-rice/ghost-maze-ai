import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { runLocalPolicy } from '../src/design/local-policy.js';
import { createReferenceEnvironment } from '../src/reference/environment.js';

const map = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const runs = [];
for (const horizon of [1, 3, 6]) for (const seed of [11, 29, 47]) {
    const result = runLocalPolicy(map, { horizon, seed }); runs.push(result);
    console.log(JSON.stringify({ horizon, seed, won: result.won, reason: result.reason, actions: result.totalActions, moves: result.movementCost }));
}
const output = resolve(process.argv[3]); mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ schemaVersion: 1, mapId: createReferenceEnvironment(map).mapId, runs,
    interpretation: '有限前瞻算法诊断，不是人类难度评分；失败只说明这组决策规则未找到解。' }, null, 2) + '\n', { flag: 'wx' });
