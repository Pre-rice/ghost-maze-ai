import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packetId, publicPacket, buildPacket } from './packet.js';
import { createFeedbackStore } from './feedback.js';
import { checkEnvironment } from '../../scripts/check-environment.mjs';
import { createRecordingStore } from './recordings.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const types = { js: 'text/javascript', css: 'text/css', html: 'text/html', svg: 'image/svg+xml' };
export async function startReviewServer({ port = 4178, host = '127.0.0.1', publicOrigin, packetFile, feedbackFile, recordingsDir = resolve(root, 'data/solutions'), webGameRoot = resolve(root, '../ghost-maze') } = {}) {
    if (publicOrigin && (!['http:', 'https:'].includes(new URL(publicOrigin).protocol) || new URL(publicOrigin).origin !== publicOrigin)) {
        throw new Error('预览地址只能包含 http/https 协议和主机，不包含路径或账号');
    }
    const packet = packetFile ? JSON.parse(readFileSync(packetFile, 'utf8')) : buildPacket();
    if (packet.id !== packetId(packet) || packet.ruleset !== checkEnvironment().revision) throw new Error('试玩包标识或引擎版本不一致，请重新构建');
    const store = createFeedbackStore(packet, feedbackFile ?? resolve(root, `data/feedback/${packet.id}.jsonl`));
    const recordings = createRecordingStore(recordingsDir);
    let origin;
    const allowedOrigins = new Set();
    const allowedHosts = new Set();
    const server = createServer(async (req, res) => {
        const send = (status, value, type = 'application/json') => {
            res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
            res.end(type === 'application/json' ? JSON.stringify(value) : value);
        };
        try {
            if (!allowedHosts.has(req.headers.host)) return send(403, { error: '请使用启动时显示的地址' });
            const url = new URL(req.url, origin), path = decodeURIComponent(url.pathname);
            if (req.method === 'GET' && path === '/api/packet') return send(200, publicPacket(packet));
            if (req.method === 'GET' && path === '/api/recordings') return send(200, recordings.list());
            if (req.method === 'GET' && path.startsWith('/api/recordings/')) return send(200, recordings.get(path.slice('/api/recordings/'.length)));
            if (req.method === 'GET' && path === '/api/feedback') return send(200, Object.fromEntries(Object.entries(store.latest()).map(([id, row]) => [id, row.input])));
            if (req.method === 'GET' && path === '/api/export') {
                res.setHeader('Content-Disposition', 'attachment; filename="ghost-maze-feedback.json"');
                return send(200, store.export());
            }
            if (req.method === 'POST' && ['/api/feedback', '/api/recordings'].includes(path)) {
                if (!allowedOrigins.has(req.headers.origin) || req.headers['content-type']?.split(';')[0] !== 'application/json') return send(403, { error: '请在当前试玩页保存反馈' });
                const chunks = []; let size = 0;
                for await (const chunk of req) {
                    size += chunk.length;
                    if (size > (path === '/api/recordings' ? 1048576 : 16384)) { send(413, { error: '内容过长' }); return; }
                    chunks.push(chunk);
                }
                const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                if (path === '/api/recordings') return send(200, recordings.save(input));
                const row = store.save(input);
                return send(200, { eventId: row.input.eventId, recordedAt: row.recordedAt });
            }
            if (req.method !== 'GET') return send(405, { error: '不支持该操作' });
            let file;
            if (path === '/') file = resolve(root, 'src/review/web/index.html');
            else if (['/app.js', '/styles.css', '/recorder.js'].includes(path)) file = resolve(root, `src/review/web${path}`);
            else if (path === '/trace-core.js') file = resolve(root, 'src/review/trace-core.js');
            else if (['/game/', '/game/index.html', '/game/help.html', '/game/editor.html', '/game/maps.html', '/game/styles.css', '/game/favicon.svg'].includes(path)) file = resolve(webGameRoot, path === '/game/' ? 'index.html' : path.slice(6));
            else if (/^\/game\/src\/[a-zA-Z0-9_/-]+\.js$/.test(path)) file = resolve(webGameRoot, path.slice(6));
            else return send(404, { error: '页面不存在' });
            let content = readFileSync(file, 'utf8');
            if (path === '/game/' || path === '/game/index.html') {
                if (!content.includes('src/vendor/pako.js')) throw new Error('本体依赖入口变化，需要更新本地适配');
                content = content.replace('</body>', '<script type="module" src="/recorder.js"></script></body>');
            }
            return send(200, content, types[file.split('.').pop()] || 'text/plain');
        } catch (error) {
            return send(error.code === 'ENOENT' ? 404 : 400, { error: error.message });
        }
    });
    await new Promise((done, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
            const localOrigin = `http://127.0.0.1:${server.address().port}`;
            origin = publicOrigin || localOrigin;
            for (const value of [localOrigin, origin]) {
                allowedOrigins.add(value);
                allowedHosts.add(new URL(value).host);
            }
            done();
        });
    });
    return { server, origin, packet };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        const args = process.argv.slice(2);
        if (args.length > 1 || (args.length && (!/^\d+$/.test(args[0]) || +args[0] > 65535))) throw new Error('用法：npm run review -- [端口]');
        const { origin } = await startReviewServer({ port: args.length ? +args[0] : 4178 });
        console.log(`试玩与反馈：${origin}\n仅在点击保存时记录反馈；按 Ctrl+C 停止。`);
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
