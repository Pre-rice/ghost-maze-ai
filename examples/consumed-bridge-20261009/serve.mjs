import { fileURLToPath } from 'node:url';
import { startReviewServer } from '../../src/review/server.mjs';

const qa = process.argv.includes('--qa');
const root = name => fileURLToPath(new URL('../../' + name, import.meta.url));
const { origin } = await startReviewServer({ port: qa ? 4185 : 4186,
    webGameRoot: fileURLToPath(new URL('../../../ghost-maze/', import.meta.url)),
    ...(qa ? { recordingsDir: root('runs/consumed-bridge-20261009/qa-recordings'), feedbackFile: root('runs/consumed-bridge-20261009/qa-feedback.jsonl') } : {}) });
console.log((qa ? '独立浏览器验收：' : '正式试玩与解法录制：') + origin + '/game/');
