import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveContinuation } from '../../src/design/continuation.js';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const map = read('map.json'), evidence = read('evidence.json'), env = createReferenceEnvironment(map);
const certificate = evidence.baseline.solution.actions;
const replay = actions => {
    let state = env.initialState(); const trace = [], valid = [];
    for (const [index, action] of actions.entries()) {
        const before = state; state = env.step(state, action);
        trace.push({ step: index + 1, action, valid: state !== before, player: [state.player.x, state.player.y],
            ghosts: state.layerStates[0].ghosts.map(g => [g.x, g.y]), dead: state.isDead, won: state.isWon });
        if (state !== before) valid.push(action);
        if (state.isDead || state.isWon) break;
    }
    return { status: state.isDead ? 'dead' : state.isWon ? 'won' : 'unfinished', trace, valid };
};
// 以下是人工提出的合理错误计划，不是观察到的用户行为。
const plans = [
    { id: 'direct_upper_key', idea: '先沿左侧绕到上方，直接拿上钥匙。', actions: [...'ULUUURRU'] },
    { id: 'reopen_at_same_station', idea: '既然上鬼已经隔开，就在右 A 原站重开，恢复上方通路。', actions: [...certificate.slice(0, 11), 'R'] },
    { id: 'restore_B_before_relocation', idea: '两处暂时安全后，从左 A 放开上鬼，直接恢复 B 去取上钥匙。', actions: [...certificate.slice(0, 17), ...'DLUUURULDDRU'] }
];
const firstPlans = plans.map(plan => ({ ...plan, result: replay(plan.actions) }));
for (const plan of firstPlans) assert.equal(plan.result.status, 'dead', plan.id);
const blockedActions = [...certificate.slice(0, 17), ...'DLUUURR'];
const blocked = replay(blockedActions);
assert.equal(blocked.status, 'unfinished'); assert.equal(blocked.trace.at(-1).valid, false);
const recovery = solveContinuation(map, blocked.valid, { nodeBudget: 120000, budgetMs: 10000 });
assert.equal(recovery.status, 'solved');
const cells = [
    [[1, 0], '上钥匙死角：取得后必须返回，不能把一次冲入当作通关'],
    [[2, 0], '上鬼初始守点及上钥匙入口'],
    [[2, 1], '上方诱导接近距离；回取钥匙与返回都经过'],
    [[3, 1], '两钥匙终点，迫使完成上方往返'],
    [[0, 2], '左 A 外侧转角；释放上鬼后可以避开中央视线'],
    [[1, 2], '左 A 站；释放与下 A 关闭同时发生，但右侧 B 入口仍须另行恢复'],
    [[2, 2], '上鬼最初诱导点、B 入口内侧和上钥匙往返分岔'],
    [[3, 2], '上鬼临时安置点和终点入口，保护必须主动解除'],
    [[0, 3], 'C 站；开桥让下鬼进入，再关闭其左侧边界'],
    [[1, 3], '下鬼最终完整隔离格；C 和 B 分别控制左右边界'],
    [[2, 3], '两鬼经过的交接通道；下鬼转移到 C 内侧时保持间距'],
    [[3, 3], '右 A 站及两鬼转向点；同站重开 A 会立即被抓'],
    [[0, 4], '初始引下鬼的直线端；后期切断上鬼视线后返回 B'],
    [[1, 4], 'B 站，先作临时保护，最后完成另一位置的保护交接'],
    [[2, 4], '下鬼临时停留格，底边仍开放；不能一直保留到完成'],
    [[3, 4], '下鬼和下钥匙初位；两次纵向诱导的接近路线'],
    [[0, 5], '沿左侧绕开两处中央门，并在后期引上鬼向左移动'],
    [[1, 5], '上鬼最终安全安置格；上 A 遮断通关路径，其他边并非全封闭'],
    [[2, 5], '从下方引出临时下鬼，并作为上鬼向左转移的中间位置'],
    [[3, 5], '右下 B 的两侧及纵向诱导转角'],
    [[0, 6], '上鬼下移后绕行左列的转角；为随后向左引鬼留出距离'],
    [[1, 6], '起点；引出下鬼及引上鬼向下后的回退路线'],
    [[2, 6], '进入下鬼纵向视线的站位，上鬼下移后的横向退路'],
    [[3, 6], '下鬼转移时的右下转角；上鬼下移时保持一格追逐间距']
].map(([cell, role]) => ({ cell, role }));
const active = map.activeCells.flatMap((row, y) => row.flatMap((on, x) => on ? [`${x},${y}`] : []));
assert.deepEqual(cells.map(({ cell }) => cell.join(',')).sort(), active.sort());
const result = { firstPlans, blocked: { idea: '两处暂时保护后，不改布局就直接去上钥匙',
    actions: blockedActions, result: blocked, recovery, scope: '直接计划受阻但可以恢复，不是永久无解状态' }, cells,
    claims: { observedHumanBehavior: false, uniqueFullOrderProven: false, everyCellIndependentCognitiveNecessityProven: false, humanQuality: null } };
writeFileSync(new URL('strategy-review.json', import.meta.url), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ firstPlans: firstPlans.map(p => [p.id, p.result.status, p.result.trace.length]),
    blocked: blocked.status, recovery: recovery.status, recoveryActions: recovery.actions.length, cells: cells.length }));
