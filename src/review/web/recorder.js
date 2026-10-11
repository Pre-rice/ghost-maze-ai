import { traceState } from '/trace-core.js';
import { ReplaySerializer } from '/game/src/core/replaySerializer.js';

let installation;
export function installRecorder(game = window.game) {
    if (installation) return installation;
    if (!game?.controller) throw new Error('游戏尚未载入');
    // 研究服务仅在后台留档；游玩和分享统一使用本体回放。
    const controller = game.controller;
    let snapshot, signature, lastSaved, queued = false;
    const take = () => {
        if (game.replay || !controller.mapData) return null;
        const actions = controller.actions;
        const map = game.generateShareCode(), replay = ReplaySerializer.generateShareCode(controller.mapData, actions);
        if (!map.success || !replay.success) throw new Error(map.error || replay.error);
        const nextSignature = map.code + ':' + replay.code;
        if (signature !== nextSignature) {
            signature = nextSignature;
            snapshot = { schemaVersion: 1, id: crypto.randomUUID(), coverage: 'retained_branch', capturedAt: new Date().toISOString(),
                sharecode: map.code, actions, ambiguities: [], final: traceState(controller.history.stateAt(controller.currentStep)) };
        }
        return snapshot;
    };
    const save = async () => {
        const input = take(); if (!input) return;
        const response = await fetch('/api/recordings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '保存失败');
        lastSaved = input.id;
        return result;
    };
    const capture = () => {
        queued = false;
        if (game.replay || !controller.currentGameState) return;
        if (!controller.currentGameState.isWon) { signature = null; return; }
        try {
            const input = take(); if (!input) return;
            if (lastSaved !== input.id) save().catch(error => { installation.error = error.message; });
        } catch (error) { installation.error = error.message; }
    };
    const previous = controller.ui.onSync;
    controller.ui.onSync = (...args) => { previous?.(...args); if (!queued) { queued = true; queueMicrotask(capture); } };
    installation = { save, capture, error: null }; capture(); return installation;
}
if (window.game) installRecorder();
else window.addEventListener('DOMContentLoaded', () => installRecorder(), { once: true });
