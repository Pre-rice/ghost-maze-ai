import { fileURLToPath } from 'node:url';
import { startReviewServer } from '../../src/review/server.mjs';
const qa = process.argv.includes('--qa');
const root = name => fileURLToPath(new URL('../../' + name, import.meta.url));
const { origin } = await startReviewServer({ port: qa ? 4191 : 4190,
    webGameRoot: fileURLToPath(new URL('../../../ghost-maze/', import.meta.url)),
    ...(qa ? { recordingsDir: root('runs/borrowed-shelter-wallfix-20261009/qa-recordings'), feedbackFile: root('runs/borrowed-shelter-wallfix-20261009/qa-feedback.jsonl') } : {}) });
console.log((qa ? '独立按钮修正验收：' : '按钮修正版试玩：') + origin + '/game/');
