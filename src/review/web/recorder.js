import { GameLogic } from '/game/src/core/gameLogic.js';
import { recoverBranch } from '/trace-core.js';

let installation;
export function installRecorder(game = window.game) {
    if (installation) return installation;
    if (!game?.controller) throw new Error('游戏尚未载入');
    const controller = game.controller, cache = new WeakMap();
    const panel = document.createElement('section');
    panel.id = 'solution-recorder';
    panel.style.cssText = 'position:relative;margin:12px;padding:12px;background:#fff;color:#253653;border:1px solid #aabbd3;border-radius:8px;z-index:10001;font:14px sans-serif';
    panel.innerHTML = '<strong>解法录制</strong><p role="status">正在读取当前路线…</p><button type="button">保存当前路线</button> <button type="button">导出 JSON</button> <a href="/replay.html" target="_blank" rel="noopener">查看已保存回放</a>';
    (document.querySelector('#game-controls') || document.body).append(panel);
    const status = panel.querySelector('p'), buttons = panel.querySelectorAll('button');
    let snapshot, signature, lastSaved, queued = false;
    const take = () => {
        if (!controller.mapDefinition || !controller.currentGameState) return;
        const branch = recoverBranch(controller.history.slice(0, controller.currentStep + 1), controller.mapDefinition, GameLogic, cache);
        const encoded = game.generateShareCode();
        if (!encoded.success) throw new Error(encoded.error);
        const nextSignature = encoded.code + JSON.stringify(branch.actions);
        if (signature !== nextSignature) {
            signature = nextSignature;
            snapshot = { schemaVersion: 1, id: crypto.randomUUID(), coverage: 'retained_branch', capturedAt: new Date().toISOString(), sharecode: encoded.code, ...branch };
            try { localStorage.setItem('ghost-maze-solution-draft', JSON.stringify(snapshot)); }
            catch { status.textContent = '浏览器无法保存草稿，请导出 JSON 或保存到本机。'; }
        }
        return snapshot;
    };
    const save = async () => {
        const input = take(); if (!input) return;
        const response = await fetch('/api/recordings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '保存失败');
        lastSaved = input.id;
        status.textContent = `已保存 ${result.verified.totalActions} 次动作，含按按钮；${result.verified.cleanWin ? '无伤通关已验证' : '当前路线已重放验证'}。`;
        panel.querySelector('a').href = `/replay.html?id=${encodeURIComponent(input.id)}`;
        return result;
    };
    const capture = () => {
        queued = false;
        try {
            const input = take(); if (!input) return;
            status.textContent = `已保留当前路线 ${input.actions.length} 次动作。通关时自动保存。`;
            if (input.final.isWon && lastSaved !== input.id) save().catch(error => { status.textContent = `自动保存失败：${error.message}。可以重试或导出。`; });
        } catch (error) { status.textContent = `录制未完成：${error.message}`; }
    };
    const previous = controller.ui.onSync;
    controller.ui.onSync = (...args) => {
        previous?.(...args);
        if (!queued) { queued = true; queueMicrotask(capture); }
    };
    buttons[0].onclick = () => save().catch(error => { status.textContent = error.message; });
    buttons[1].onclick = () => {
        try {
            const input = take(); if (!input) return;
            const url = URL.createObjectURL(new Blob([JSON.stringify(input, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = `ghost-maze-solution-${input.id}.json`; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) { status.textContent = error.message; }
    };
    installation = { save, capture }; capture(); return installation;
}

// 旧页面可在控制台 import 此模块，无需刷新，即可恢复仍保留的历史分支。
if (!new URLSearchParams(location.search).has('replay')) {
    if (window.game) installRecorder();
    else window.addEventListener('DOMContentLoaded', () => installRecorder(), { once: true });
}
