const form = document.querySelector('#feedback'), status = document.querySelector('#status');
const draftFields = ['playedA', 'playedB', 'priorExposure', 'choice', 'reason'];
let packet, current, records = {}, drafts = {}, pending = null;
const notify = (message, error = false) => { status.textContent = message; status.classList.toggle('error', error); };
const request = async (url, options) => {
    const response = await fetch(url, options), data = await response.json();
    if (!response.ok) throw new Error(data.error || '保存失败，请重试');
    return data;
};
const readDraft = () => Object.fromEntries(draftFields.map(key => [key, form.elements[key].value]));
const draftKey = () => `ghost-maze-review:${packet.id}`;
function keepDraft() {
    if (!current) return;
    drafts[current.id] = readDraft();
    try { localStorage.setItem(draftKey(), JSON.stringify(drafts)); } catch { notify('浏览器无法保存草稿；请及时点击保存。', true); }
}
function render(pair) {
    keepDraft(); current = pair; pending = null; form.reset();
    const value = drafts[pair.id] || records[pair.id];
    if (value) for (const key of draftFields) form.elements[key].value = value[key];
    document.querySelector('#pair-title').textContent = `第 ${packet.pairs.indexOf(pair) + 1} 组`;
    for (const side of ['a', 'b']) {
        const link = document.querySelector(`#play-${side}`);
        link.href = `/game/?map=${encodeURIComponent(pair[side].sharecode)}`;
        link.target = `ghost-review-${pair.id}-${side}`;
    }
    for (const button of document.querySelectorAll('nav button')) button.setAttribute('aria-current', String(button.dataset.id === pair.id));
    notify(records[pair.id] ? '这组已有记录，可以修改后再次保存。' : '尚未保存这组比较。');
}
form.addEventListener('input', () => { pending = null; keepDraft(); notify('草稿已更新，点击保存后才会记入反馈。'); });
form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.querySelector('#save');
    button.disabled = true;
    // 请求结果不明时重试同一事件；改表单后产生新事件，避免重复计票。
    pending ??= { eventId: crypto.randomUUID(), packetId: packet.id, pairId: current.id, ...readDraft() };
    const submitted = pending;
    try {
        await request('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submitted) });
        records[submitted.pairId] = submitted;
        if (current.id === submitted.pairId) notify('已保存到本机。你可以继续下一组，或导出记录。');
        document.querySelector(`nav button[data-id="${submitted.pairId}"]`).textContent = `第 ${packet.pairs.findIndex(p => p.id === submitted.pairId) + 1} 组 · 已记录`;
        if (pending === submitted) pending = null;
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = false; }
});

try {
    [packet, records] = await Promise.all([request('/api/packet'), request('/api/feedback')]);
    try { drafts = JSON.parse(localStorage.getItem(draftKey()) || '{}'); } catch { drafts = {}; }
    if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts)) drafts = {};
    for (const [index, pair] of packet.pairs.entries()) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.id = pair.id;
        button.textContent = `第 ${index + 1} 组${records[pair.id] ? ' · 已记录' : ''}`;
        button.addEventListener('click', () => render(pair)); document.querySelector('#pairs').append(button);
    }
    render(packet.pairs[0]);
    document.querySelector('#save').disabled = false;
} catch (error) { notify(`无法载入试玩包：${error.message}`, true); document.querySelector('#save').disabled = true; }
