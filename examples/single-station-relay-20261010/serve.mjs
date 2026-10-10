import { fileURLToPath } from 'node:url';
import { startReviewServer } from '../../src/review/server.mjs';

const qa = process.argv.includes('--qa'), root = name => fileURLToPath(new URL('../../' + name, import.meta.url));
const { origin } = await startReviewServer({ port: qa ? 4211 : 4210,
    webGameRoot: fileURLToPath(new URL('../../../ghost-maze/', import.meta.url)),
    ...(qa ? { recordingsDir: root('runs/single-station-relay-20261010/qa-recordings'), feedbackFile: root('runs/single-station-relay-20261010/qa-feedback.jsonl') } : {}) });
console.log((qa ? '独立验收：' : '新题试玩：') + origin + '/game/');
