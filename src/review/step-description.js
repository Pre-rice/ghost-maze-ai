import { actionFromName } from '../reference/engine.js';
export function describeStep(before, after, token, def, wallTypes) {
    const action = actionFromName(token), p = before.player;
    const button = action.type === 'MOVE' && def.layers[p.layer].initialEntities.buttons.find(b =>
        b.x === p.x && b.y === p.y && b.direction.dx === action.payload.dx && b.direction.dy === action.payload.dy);
    const gates = state => state.layerStates.flatMap((layer, li) => ['h', 'v'].flatMap(axis =>
        layer.wallStates[axis].flatMap((row, y) => row.flatMap((w, x) => w.type === wallTypes.LETTER_DOOR ? [{ layer: li, axis, x, y, letter: w.letter, state: w.currentState }] : []))));
    const oldGates = gates(before), newGates = gates(after);
    return { token, label: button ? `按 ${button.letter}（原地推进一回合）` : ({ U: '上', R: '右', D: '下', L: '左', STAIR: '使用楼梯', REVIVE: '复活' })[token],
        button: button ? button.letter : null,
        playerBefore: [p.layer, p.x, p.y], playerAfter: [after.player.layer, after.player.x, after.player.y],
        ghostsBefore: before.layerStates.map(l => l.ghosts.map(g => [g.x, g.y])), ghostsAfter: after.layerStates.map(l => l.ghosts.map(g => [g.x, g.y])),
        gateChanges: newGates.filter((g, i) => g.state !== oldGates[i]?.state), isDead: after.isDead, isWon: after.isWon };
}
