import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { request } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const game = resolve(root, '../ghost-maze');
assert(Number(process.versions.node.split('.')[0]) >= 20, '需要 Node.js 20 或更高，已验收版本为 22.21.1');
assert(existsSync(resolve(game, 'src/core/actionHistory.js')), '请将 ghost-maze 和 ghost-maze-ai 配置为同级目录，使用两个仓库的最新 main');

for (const [cwd, script] of [[game, 'test/run-all.mjs'], [root, 'scripts/check-environment.mjs'],
    [root, 'scripts/test.mjs'], [root, 'scripts/verify-seeds.mjs']]) {
    const result = spawnSync(process.execPath, [script], { cwd, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}

const { startCloudServer } = await import('./cloud-serve.mjs');
const { server, origin } = await startCloudServer({ port: 0, recordingsDir: resolve(root, 'runs/cloud/qa-recordings') });
try {
    for (const path of ['/game/', '/game/editor.html', '/game/help.html', '/game/maps.html', '/game/styles.css',
        '/game/src/maps/gallery.js', '/game/src/maps/ai-gallery.js',
        '/game/src/main.js', '/game/src/core/gameLogic.js', '/game/src/vendor/pako.js', '/api/packet']) {
        const response = await fetch(origin + path);
        assert.equal(response.status, 200, `云端入口不可用：${path}`);
        assert((await response.text()).length > 0, `云端入口内容为空：${path}`);
    }
    console.log('✓ 云端工作流：本体、AI、规则锁、原种子及 11 个 HTTP 入口全部通过');
} finally {
    await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
}

// 模拟预览代理保留和改写 Host 两种情况，地址检查不能阻止云端页面留档。
const publicOrigin = 'https://ghost-maze-cloud.invalid';
const preview = await startCloudServer({ port: 0, host: '0.0.0.0', publicOrigin,
    recordingsDir: resolve(root, 'runs/cloud/qa-recordings') });
const localOrigin = `http://127.0.0.1:${preview.server.address().port}`;
function proxyRequest(path, { headers = {}, method = 'GET', body } = {}) {
    // 原生 fetch 会改写 Host，用 HTTP 请求核验代理实际发送的头部。
    return new Promise((done, reject) => {
        const req = request(new URL(path, localOrigin), { method, headers }, response => {
            response.resume();
            response.once('end', () => done(response.statusCode));
        });
        req.once('error', reject);
        req.end(body);
    });
}
try {
    assert.equal(preview.origin, publicOrigin);
    for (const host of [new URL(publicOrigin).host, new URL(localOrigin).host]) {
        const status = await proxyRequest('/game/', { headers: { Host: host } });
        assert.equal(status, 200, '预览代理地址必须能打开本体');
    }
    const save = await proxyRequest('/api/feedback', { method: 'POST',
        headers: { Host: new URL(publicOrigin).host, Origin: publicOrigin, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(save, 400, '预览来源应进入资料校验，空反馈不得保存');
    const wrongOrigin = await proxyRequest('/api/feedback', { method: 'POST',
        headers: { Origin: 'https://other.invalid', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(wrongOrigin, 403, '未配置来源不得写入反馈');
    const wrongHost = await proxyRequest('/game/', { headers: { Host: 'other.invalid' } });
    assert.equal(wrongHost, 403, '未配置地址不得读取资料');
    console.log('✓ 云端预览代理地址与留档来源检查通过；未写入真人反馈');
} finally {
    await new Promise((done, reject) => preview.server.close(error => error ? reject(error) : done()));
}
