import { traceAction } from '/trace-core.js';

const error = document.querySelector('#record-error'), frame = document.querySelector('#game');
let record, states, game, index = 0;
const request = async (url, options) => {
    const response = await fetch(url, options), body = await response.json();
    if (!response.ok) throw new Error(body.error || '读取录制失败');
    return body;
};
function show(position) {
    index = Math.max(0, Math.min(states.length - 1, Number(position)));
    const state = states[index], c = game.controller;
    game.stopAnimationLoop(); game.hideAllOverlays();
    c.currentGameState = state; c.viewLayer = state.player.layer;
    c.history = states.slice(0, index + 1); c.currentStep = index;
    c.ui.onSync?.();
    document.querySelector('#position').value = index;
    document.querySelector('#counter').textContent = `${index} / ${states.length - 1}`;
    document.querySelector('#previous').disabled = index === 0;
    document.querySelector('#next').disabled = index === states.length - 1;
    const step = record.verified.steps[index - 1];
    const playerText = p => `第 ${p[0] + 1} 层 (${p[1]},${p[2]})`;
    const ghostText = layers => layers.flatMap((ghosts, layer) => ghosts.map((p, g) => `第 ${layer + 1} 层鬼 ${g + 1} (${p.join(',')})`)).join('；') || '无';
    document.querySelector('#info').textContent = index === 0 ? '初始状态' :
        `${step.label}\n玩家：${playerText(step.playerBefore)} → ${playerText(step.playerAfter)}\n鬼：${ghostText(step.ghostsBefore)} → ${ghostText(step.ghostsAfter)}\n门变化：${step.gateChanges.map(g => `${g.letter} ${g.axis === 'h' ? '横边' : '竖边'}(${g.x},${g.y}) ${g.state === 'open' ? '打开' : '关闭'}`).join('；') || '无'}\n${step.isWon ? '到达终点' : step.isDead ? '死亡' : ''}`;
    document.querySelectorAll('#steps button').forEach((button, i) => button.setAttribute('aria-current', String(i + 1 === index)));
}
async function load(id) {
    record = await request(`/api/recordings/${encodeURIComponent(id)}`);
    const ready = new Promise(resolve => { frame.onload = resolve; });
    frame.src = `/game/?map=${encodeURIComponent(record.input.sharecode)}&replay=1`;
    await ready;
    game = frame.contentWindow.game;
    if (!game?.controller.currentGameState) throw new Error('回放游戏未能加载');
    const { GameLogic } = await import('/game/src/core/gameLogic.js');
    states = [game.controller.currentGameState];
    for (const token of record.input.actions) states.push(GameLogic.calculateNextState(states.at(-1), traceAction(token), game.controller.mapDefinition));
    // 隔离的只读回放页使用原版绘制；不触碰原先试玩标签页的控制器。
    const style = frame.contentDocument.createElement('style');
    style.textContent = '.controls-panel,#layer-panel,#dpad-controls{display:none!important}.main-container{display:block!important}body{margin:0!important;padding:0!important}.canvas-wrapper{max-width:100%}#game-canvas{max-width:100%;height:auto}'; frame.contentDocument.head.append(style);
    document.querySelector('#controls').hidden = false;
    document.querySelector('#position').max = states.length - 1;
    document.querySelector('#download').href = `/api/recordings/${encodeURIComponent(id)}`;
    const list = document.querySelector('#steps'); list.replaceChildren();
    record.verified.steps.forEach((step, i) => {
        const li = document.createElement('li'), button = document.createElement('button');
        button.textContent = `${i + 1}. ${step.label}`; button.type = 'button';
        if (step.button) button.className = 'button-step';
        button.onclick = () => show(i + 1); li.append(button); list.append(li);
    });
    show(0);
}
document.querySelector('#previous').onclick = () => show(index - 1);
document.querySelector('#next').onclick = () => show(index + 1);
document.querySelector('#position').oninput = event => show(event.target.value);
document.querySelector('#import').onchange = async event => {
    try {
        const data = JSON.parse(await event.target.files[0].text());
        const input = data.input || data;
        await request('/api/recordings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        await load(input.id); error.textContent = '已导入并通过原引擎重放验证。';
    } catch (e) { error.textContent = e.message; }
};
try {
    const id = new URLSearchParams(location.search).get('id');
    if (id) await load(id);
    else {
        const rows = await request('/api/recordings');
        const list = document.querySelector('#list');
        if (!rows.length) list.textContent = '还没有保存的解法。在带录制面板的游戏页完成一局，或导入 JSON。';
        for (const row of rows) {
            const link = document.createElement('a'); link.href = `/replay.html?id=${encodeURIComponent(row.id)}`;
            link.textContent = `${new Date(row.savedAt).toLocaleString()} · ${row.totalActions} 次动作 · ${row.cleanWin ? '无伤通关' : row.won ? '通关路线（含复活）' : '未完成路线'}`; list.append(link);
        }
    }
} catch (e) { error.textContent = e.message; }
