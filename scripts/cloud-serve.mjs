import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPacket } from '../src/review/packet.js';
import { startReviewServer } from '../src/review/server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

export async function startCloudServer(options = {}) {
    // 旧跨层试玩包存在已注明的数据冲突，云端入口只使用已核验的原种子。
    const packet = buildPacket(20260930, [['lure-loop-v1',
        'examples/puzzle-units/unit-01.json', 'examples/puzzle-units/unit-02.json']]);
    const folder = resolve(root, 'runs/cloud');
    mkdirSync(folder, { recursive: true });
    const packetFile = resolve(folder, 'packet.json');
    writeFileSync(packetFile, JSON.stringify(packet, null, 2) + '\n');
    return startReviewServer({ packetFile, ...options });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const input = process.argv[2] ?? process.env.PORT ?? '4206';
    if (process.argv.length > 3 || !/^\d+$/.test(input) || Number(input) > 65535) {
        console.error('用法：npm run cloud:serve -- [端口]');
        process.exitCode = 1;
    } else {
        const { origin } = await startCloudServer({ port: Number(input), host: process.env.GHOST_MAZE_HOST || '127.0.0.1', publicOrigin: process.env.GHOST_MAZE_ORIGIN });
        console.log(`鬼迷宫：${origin}/game/\n编辑器：${origin}/game/editor.html\n按 Ctrl+C 停止。`);
    }
}
