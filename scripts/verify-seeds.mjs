import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { GameLogic, MapDefinition, DataSerializer } from '../src/reference/engine.js';
import { checkEnvironment } from './check-environment.mjs';

const root = new URL('../', import.meta.url);
const read = file => JSON.parse(readFileSync(new URL(file, root), 'utf8'));
const directions = { U: { dx: 0, dy: -1 }, R: { dx: 1, dy: 0 }, D: { dx: 0, dy: 1 }, L: { dx: -1, dy: 0 } };
const comparable = state => JSON.parse(JSON.stringify(state, (key, value) => key === 'trail' ? undefined : value));

// 仅重放已给定的四方向证书，不承担通用求解或最优性证明。
export function replay(map, sequence) {
    const def = new MapDefinition(map);
    let state = GameLogic.createInitialState(def);
    const states = [comparable(state)]; let movementCost = 0;
    for (const name of sequence) {
        assert(directions[name], `非法动作：${name}`);
        assert(!state.isWon && !state.isDead, '证书包含终止状态后的多余动作');
        const next = GameLogic.calculateNextState(state, { type: 'MOVE', payload: directions[name] }, def);
        assert.notEqual(next, state, '证书包含未生效动作');
        assert(!next.isDead, '证书重放时死亡');
        if(next.player.x!==state.player.x||next.player.y!==state.player.y||next.player.layer!==state.player.layer) movementCost++;
        state = next;
        states.push(comparable(state));
    }
    return { state, states, movementCost };
}

export function verifySeeds() {
    checkEnvironment();
    const manifest = read('data/manifests/seed-units.json');
    const evidence = read('examples/puzzle-units/verification.json');
    return manifest.seeds.map(seed => {
        const map = read(seed.file);
        const encoded = DataSerializer.generateShareCode(map);
        assert(encoded.success, encoded.error);
        const decoded = DataSerializer.loadFromShareCode(encoded.code);
        assert(decoded.success, decoded.error);
        const { mapData, gameMode, initialHealth } = decoded.data;
        const restored = { ...mapData, gameMode, initialHealth };
        const before = replay(map, seed.sequence);
        const after = replay(restored, seed.sequence);
        assert.deepEqual(after.states, before.states, '分享码前后完整规则状态不一致');
        assert(after.state.isWon, '证书未到达终点');
        assert.equal(seed.sequence.length, seed.actions);
        assert.equal(after.movementCost, seed.movementCost);
        assert.equal(after.state.player.steps, seed.actions);
        const record = evidence.units.find(unit => unit.id === seed.id);
        assert.equal(record.search.shortest, seed.sequence, '种子清单与证书动作不一致');
        assert.deepEqual(after.states.map((state, index) => ({
            action: index === 0 ? null : seed.sequence[index - 1],
            player: [state.player.x, state.player.y],
            ghosts: state.layerStates[0].ghosts.map(g => [g.x, g.y]),
            gate: map.buttons.length ? state.layerStates[0].wallStates.v[2][3].currentState : null,
            won: state.isWon, dead: state.isDead
        })), record.trace.map(({steps,stamina,...physical})=>physical), '重放与已记录的逐步证据不一致');
        const exitMap=structuredClone(restored);exitMap.layers.forEach(layer=>{layer.endPos=null;});
        const exit = replay(exitMap, seed.sequence).state;
        const expected = record.exitWithoutGoal;
        assert.deepEqual([exit.player.x, exit.player.y], expected.player);
        assert.deepEqual(exit.layerStates[0].ghosts.map(g => [g.x, g.y]), expected.ghosts);
        if (expected.gate) assert.equal(exit.layerStates[0].wallStates.v[2][3].currentState, expected.gate);
        return { id: seed.id, actions: seed.actions, movementCost: seed.movementCost, shareCode: encoded.code };
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    for (const result of verifySeeds()) console.log(`✓ ${result.id}：${result.actions} 步、${result.movementCost} 次位移，分享码与单元出口重放通过`);
}
