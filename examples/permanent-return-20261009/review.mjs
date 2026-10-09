import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveContinuation } from '../../src/design/continuation.js';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const map = read('map.json'), evidence = read('evidence.json'), env = createReferenceEnvironment(map);
const moves = text => [...text];
const plans = [
    { id: 'walk_straight_to_left_A', idea: '沿左侧直接去 A，等看见出口再决定。', actions: moves('UUUUL') },
    { id: 'get_key_then_switch_without_lower_setup', idea: '先把钥匙拿到，切 A，再恢复 B 为上方鬼提供诱导口。', actions: moves('UULURRDULLULDDL') },
    { id: 'open_upper_route_then_walk_to_goal', idea: '完成下方准备，开数字门并在右侧切 A 后，直接向上走。', actions: [...evidence.solution.solution.actions.slice(0, 22), 'L', 'U'] }
];
const replay = actions => {
    let state = env.initialState(); const trace = [], valid = [];
    for (const [index, action] of actions.entries()) {
        const before = state; state = env.step(state, action);
        trace.push({ step: index + 1, action, valid: state !== before, player: [state.player.x, state.player.y], ghosts: state.layerStates[0].ghosts.map(g => [g.x, g.y]), dead: state.isDead, won: state.isWon });
        if (state !== before) valid.push(action);
        if (state.isDead || state.isWon) break;
    }
    return { status: state.isDead ? 'dead' : state.isWon ? 'won' : 'unfinished', trace, valid };
};
const firstPlans = plans.map(plan => ({ ...plan, result: replay(plan.actions) }));
for (const plan of firstPlans) assert.equal(plan.result.status, 'dead', plan.id);

const premature = [...evidence.solution.solution.actions.slice(0, 30), 'U', 'U', 'L', 'R'];
const wrongStation = replay(premature); assert.equal(wrongStation.status, 'unfinished'); assert.equal(wrongStation.trace.at(-1).valid, false);
const recovery = solveContinuation(map, wrongStation.valid, { nodeBudget: 50000, budgetMs: 5000 }); assert.equal(recovery.status, 'solved');
const roles = [
    [[1,0], '终点与上方走廊的转角'], [[2,0], '上鬼初始守点，最终出口入口'], [[2,1], '上方诱导所需距离及鬼接近的中间站'],
    [[1,2], '左 A 站与单向退口'], [[2,2], '上鬼移位、中央入口与永久通路的交汇'], [[3,2], '右 A 站，必须进来切门，再穿已消耗数字门返回'],
    [[1,3], '左右按钮交接与诱导回退的转角'], [[2,3], '中央通道与 A 下门，先取得右侧控制权，后让上鬼下移'], [[3,3], '取钥匙的转角与右侧 A 房间的实墙隔离'],
    [[1,4], 'B 站、初始诱导与后续上鬼捕获的保护站'], [[2,4], '两只鬼先后占用的诱导口与 B 捕获格'], [[3,4], '下鬼初位及钥匙，去下方诱导区的入口'],
    [[1,5], '单向门下侧，选中解中下鬼最终停留处'], [[2,5], '下鬼离开共享格时的中间位置'], [[3,5], 'B 下门内侧与下方诱导的接近路线'],
    [[1,6], '出生点及下方诱导后的回退方向'], [[2,6], '纵向诱导下鬼的站位'], [[3,6], '进入诱导视线的转角，保持两个回合的间距']
].map(([cell, role]) => ({ cell, role }));
assert.equal(roles.length, map.activeCells.flat().filter(Boolean).length);
const result = { firstPlans, wrongStation: { plan: '捕获后在左侧切 A，再尝试直接进入中央', actions: premature, result: wrongStation, recovery,
    scope: '直接计划被入口关闭和单向门阻挡，仍可恢复；没有把它说成永久无解' }, cells: roles,
    claims: { observedHumanBehavior: false, minimumTransitGlobalProof: false, humanQuality: null } };
writeFileSync(new URL('strategy-review.json', import.meta.url), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ firstPlans: firstPlans.map(p => [p.id, p.result.status, p.result.trace.length]), wrongStation: wrongStation.status,
    recovery: recovery.status, recoveryActions: recovery.actions.length, roles: roles.length }));
