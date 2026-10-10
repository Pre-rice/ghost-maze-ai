import { resolve } from 'node:path';
import { startReviewServer } from '../../src/review/server.mjs';

const qa = process.argv.includes('--qa');
const { origin } = await startReviewServer({ port: qa ? 4213 : 4212, webGameRoot: resolve('../ghost-maze'),
    ...(qa ? { recordingsDir: resolve('runs/return-to-source-20261010/qa-recordings'), feedbackFile: resolve('runs/return-to-source-20261010/qa-feedback.jsonl') } : {}) });
console.log((qa ? '参考回放：' : '新题试玩：') + origin + '/game/');
